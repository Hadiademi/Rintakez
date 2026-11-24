import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { adminPageClient, requireAdminProfile } from "@/lib/admin/guard";
import { AdminUserRow } from "@/components/admin-user-row";
import { AdminPageHeader } from "@/components/admin-page-header";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "active", "suspended"] as const;
type StatusFilter = (typeof STATUSES)[number];

// Photographers and clients are listed apart (?role=); "all" keeps both.
const ROLES = ["all", "photographer", "client"] as const;
type RoleFilter = (typeof ROLES)[number];

const LIMIT = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; role?: string }>;
}) {
  const { q, status: statusParam, role: roleParam } = await searchParams;
  const status: StatusFilter = (STATUSES as readonly string[]).includes(
    statusParam ?? ""
  )
    ? (statusParam as StatusFilter)
    : "all";
  const role: RoleFilter = (ROLES as readonly string[]).includes(roleParam ?? "")
    ? (roleParam as RoleFilter)
    : "all";

  // Query string for links that change one filter and keep the others.
  const href = (next: { role?: RoleFilter; status?: StatusFilter }) => {
    const params = new URLSearchParams();
    params.set("role", next.role ?? role);
    params.set("status", next.status ?? status);
    if (q) params.set("q", q);
    return `/admin/users?${params.toString()}`;
  };

  const t = await getTranslations("admin");
  const [me, admin] = await Promise.all([requireAdminProfile(), adminPageClient()]);
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  let query = admin
    .from("profiles")
    .select("id, display_name, role, is_admin, is_suspended, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (role !== "all") query = query.eq("role", role);
  if (status === "suspended") query = query.eq("is_suspended", true);
  if (status === "active") query = query.eq("is_suspended", false);
  if (q?.trim()) query = query.ilike("display_name", `%${q.trim()}%`);

  // Tab counts: how many photographers / clients exist in total.
  const countRole = (r?: "photographer" | "client") => {
    let c = admin.from("profiles").select("id", { count: "exact", head: true });
    if (r) c = c.eq("role", r);
    return c;
  };
  const [{ data: rows }, allCount, photographerCount, clientCount] = await Promise.all([
    query,
    countRole(),
    countRole("photographer"),
    countRole("client"),
  ]);
  const roleCount: Record<RoleFilter, number | null> = {
    all: allCount.count,
    photographer: photographerCount.count,
    client: clientCount.count,
  };
  const list = rows ?? [];

  // Resolve emails (admin-only) for exactly the displayed page of users
  // (≤ LIMIT rows) via per-id lookups rather than scanning listUsers, whose
  // 1000-row cap would silently blank emails for any displayed user beyond
  // the first 1000 auth rows once the platform grows past that.
  const emailResults = await Promise.all(
    list.map((u) => admin.auth.admin.getUserById(u.id))
  );
  const emailBy = new Map(
    list.map((u, i) => [u.id, emailResults[i]?.data.user?.email ?? ""])
  );

  // Batch-fetch active admin comps for the rendered page of users in one
  // query rather than N+1 per row.
  const ids = list.map((u) => u.id);
  const compBy = new Map<string, { plan: string; until: string }>();
  if (ids.length > 0) {
    const { data: comps } = await admin
      .from("subscriptions")
      .select("user_id, plan, source, comp_until")
      .in("user_id", ids)
      .eq("source", "admin_comp");
    const now = new Date().getTime();
    for (const c of comps ?? []) {
      if (c.comp_until && new Date(c.comp_until).getTime() > now) {
        compBy.set(c.user_id, { plan: c.plan, until: c.comp_until });
      }
    }
  }

  return (
    <section className="space-y-4">
      <AdminPageHeader eyebrow={t("eyebrowManagement")} title={t("tabUsers")} />
      {/* One row at every width: on a phone the three tabs scroll sideways
          rather than wrap the active tab onto a line of its own. */}
      <nav
        aria-label={t("roleFilterAria")}
        className="flex overflow-x-auto border-b border-line [scrollbar-width:none]"
      >
        {ROLES.map((r) => (
          <Link
            key={r}
            href={href({ role: r })}
            aria-current={r === role ? "page" : undefined}
            data-testid={`admin-users-role-${r}`}
            className={`-mb-px flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-[14px] sm:px-3 sm:text-[15px] ${
              r === role
                ? "border-ink font-medium text-ink"
                : "border-transparent text-mute hover:text-ink"
            }`}
          >
            {t(`roleFilter.${r}`)}
            {roleCount[r] !== null ? (
              <span className="tabular-nums text-[13px] text-mute">{roleCount[r]}</span>
            ) : null}
          </Link>
        ))}
      </nav>
      <nav className="flex flex-wrap gap-3 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={href({ status: s })}
            aria-current={s === status ? "page" : undefined}
            className={
              s === status ? "font-medium text-ink" : "text-mute hover:text-ink"
            }
          >
            {t(`userFilter.${s}`)}
          </Link>
        ))}
      </nav>

      <form method="get" className="flex gap-2">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchUsers")}
          className="min-w-0 flex-1 border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          className="press border border-line px-4 py-2 text-sm text-ink"
        >
          {t("search")}
        </button>
      </form>

      {list.length === 0 ? (
        <p className="text-mute">{t("noUsers")}</p>
      ) : (
        <div className="space-y-3">
          {list.map((u) => (
            <AdminUserRow
              key={u.id}
              id={u.id}
              name={u.display_name}
              email={emailBy.get(u.id) ?? ""}
              role={u.role}
              isAdmin={u.is_admin}
              isSuspended={u.is_suspended}
              isSelf={me?.id === u.id}
              comp={compBy.get(u.id) ?? null}
            />
          ))}
        </div>
      )}
      {list.length === LIMIT ? (
        <p className="label text-mute-2">{t("resultsCapped", { n: LIMIT })}</p>
      ) : null}
    </section>
  );
}
