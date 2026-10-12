import { captureError } from "@/lib/observability";

/**
 * Convert a Supabase/Postgres error into a safe, stable client code. The raw
 * error carries internals — Postgres SQLSTATEs, table/constraint names, row
 * detail — that must never travel to the browser, so it is logged server-side
 * and the caller returns only "generic". The UI maps that via `errorKey()` like
 * any other code. `scope` tags the log so the origin is identifiable even though
 * Supabase errors are plain objects without a stack.
 */
export function dbError(error: unknown, scope: string): "generic" {
  captureError(error, { scope });
  return "generic";
}

/**
 * True when `error` is a deliberate refusal raised by a database trigger
 * (`raise exception '<code>' using errcode = 'P0001'`), e.g. the bid quota
 * ("quota_reached") or the report throttle ("limit_reached"). Those carry a
 * user-facing code and must not be collapsed into "generic".
 */
export function isDbRefusal(error: unknown, code: string): boolean {
  const e = error as { code?: unknown; message?: unknown } | null | undefined;
  return e?.code === "P0001" && e?.message === code;
}
