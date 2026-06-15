import { getStore } from "./store";

// A minimal stand-in for the supabase-js PostgREST query builder, operating on
// the in-memory demo store. Supports only the chain shapes the app issues
// (enumerated from the codebase). The object is thenable: `await query` resolves
// `{ data, count, error }`; `.single()/.maybeSingle()` resolve a single row.
// Mutations act on the live store arrays so writes are visible in-session.

type Row = Record<string, any>;
type Filter = (r: Row) => boolean;
type Op = "select" | "insert" | "update" | "delete" | "upsert";

// Tables whose primary key is composite (no synthetic `id` column).
const COMPOSITE_PK = new Set([
  "favorites",
  "photographer_unavailable",
  "photographer_details",
]);

// Columns the real DB fills with defaults on insert.
const STATUS_DEFAULT: Record<string, string> = {
  shoots: "open",
  bids: "pending",
  reports: "open",
};

function withDefaults(table: string, row: Row): Row {
  const r = { ...row };
  if (r.id === undefined && !COMPOSITE_PK.has(table)) r.id = crypto.randomUUID();
  if (r.created_at === undefined) r.created_at = new Date().toISOString();
  if (STATUS_DEFAULT[table] && r.status === undefined)
    r.status = STATUS_DEFAULT[table];
  return r;
}

export class MockQuery implements PromiseLike<any> {
  private filters: Filter[] = [];
  private op: Op = "select";
  private payload: any;
  private conflictKeys: string[] = [];
  private selectCols = "*";
  private countMode: "exact" | "planned" | "estimated" | null = null;
  private headOnly = false;
  private orderKey: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private rangeFromTo: [number, number] | null = null;
  private ran = false;

  constructor(private table: string) {}

  private get rows(): Row[] {
    const s = getStore() as any;
    if (!s[this.table]) s[this.table] = [];
    return s[this.table];
  }

  // ── shape ──────────────────────────────────────────────────────────
  select(cols = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    this.selectCols = cols;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictKeys = opts?.onConflict
      ? opts.onConflict.split(",").map((s) => s.trim())
      : ["id"];
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  // ── filters ────────────────────────────────────────────────────────
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] <= v); return this; }
  gt(c: string, v: any) { this.filters.push((r) => r[c] > v); return this; }
  lt(c: string, v: any) { this.filters.push((r) => r[c] < v); return this; }
  ilike(c: string, pattern: string) {
    const re = new RegExp("^" + escapeRe(pattern).replace(/%/g, ".*") + "$", "i");
    this.filters.push((r) => re.test(String(r[c] ?? "")));
    return this;
  }
  contains(c: string, vals: any[]) {
    this.filters.push((r) => Array.isArray(r[c]) && vals.every((x) => r[c].includes(x)));
    return this;
  }
  or(expr: string) {
    // "col.eq.val,col2.eq.val2" — only the eq operator is used by the app.
    const clauses = expr.split(",").map((s) => s.split("."));
    this.filters.push((r) =>
      clauses.some(([col, , val]) => String(r[col]) === val)
    );
    return this;
  }
  order(c: string, opts?: { ascending?: boolean }) {
    this.orderKey = c;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.rangeFromTo = [from, to]; return this; }

  // ── execution ──────────────────────────────────────────────────────
  private filtered(): Row[] {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderKey) {
      const k = this.orderKey;
      const dir = this.orderAsc ? 1 : -1;
      out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir);
    }
    if (this.rangeFromTo) out = out.slice(this.rangeFromTo[0], this.rangeFromTo[1] + 1);
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  /** Performs the operation once and returns the affected/selected rows. */
  protected affected(): Row[] {
    if (this.ran) return this.lastRows;
    this.ran = true;
    if (this.op === "insert") {
      const added = (this.payload as Row[]).map((r) => withDefaults(this.table, r));
      this.rows.push(...added);
      return (this.lastRows = added);
    }
    if (this.op === "upsert") {
      const result: Row[] = [];
      for (const raw of this.payload as Row[]) {
        const existing = this.rows.find((r) =>
          this.conflictKeys.every((k) => r[k] === raw[k])
        );
        if (existing) {
          Object.assign(existing, raw);
          result.push(existing);
        } else {
          const added = withDefaults(this.table, raw);
          this.rows.push(added);
          result.push(added);
        }
      }
      return (this.lastRows = result);
    }
    if (this.op === "update") {
      const matched = this.filtered();
      matched.forEach((r) => Object.assign(r, this.payload));
      return (this.lastRows = matched);
    }
    if (this.op === "delete") {
      const matched = this.filtered();
      const live = this.rows;
      for (const r of matched) {
        const i = live.indexOf(r);
        if (i >= 0) live.splice(i, 1);
      }
      return (this.lastRows = matched);
    }
    return (this.lastRows = this.filtered());
  }
  private lastRows: Row[] = [];

  /** Hook for subclasses (embedded-relation resolution). */
  protected shape(rows: Row[]): Row[] {
    return rows;
  }

  private result() {
    const rows = this.shape(this.affected());
    return {
      data: this.headOnly ? null : rows,
      count: this.countMode ? rows.length : null,
      error: null as null | { message: string },
    };
  }

  single() {
    const rows = this.shape(this.affected());
    return Promise.resolve(
      rows[0]
        ? { data: rows[0], error: null }
        : { data: null, error: { message: "no rows", code: "PGRST116" } }
    );
  }
  maybeSingle() {
    const rows = this.shape(this.affected());
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
}

function escapeRe(s: string): string {
  // escape regex specials except % (our wildcard)
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\%/g, "%");
}

export function from(table: string): MockQuery {
  return new MockQuery(table);
}
