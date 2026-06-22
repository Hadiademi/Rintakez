import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminUserRow } from "@/components/admin-user-row";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "active", "suspended"] as const;
type StatusFilter = (typeof STATUSES)[number];

const LIMIT = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status: statusParam } = await searchParams;
  const status: StatusFilter = (STATUSES as readonly string[]).includes(
    statusParam ?? ""
  )
    ? (statusParam as StatusFilter)
    : "all";

  const t = await getTranslations("admin");
  const [me, admin] = await Promise.all([getProfile(), createAdminClient()]);
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  let query = admin
    .from("profiles")
    .select("id, display_name, role, is_admin, is_suspended, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (status === "suspended") query = query.eq("is_suspended", true);
  if (status === "active") query = query.eq("is_suspended", false);
  if (q?.trim()) query = query.ilike("display_name", `%${q.trim()}%`);

  const { data: rows } = await query;

  // Resolve emails (admin-only). For this scale a single listUsers call is fine;
  // at large scale replace with a server-side join/RPC.
  const { data: authList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailBy = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const list = rows ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {t("tabUsers")}
        </h2>
        <nav className="flex gap-3 text-sm">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/users?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={s === status ? "page" : undefined}
              className={
                s === status ? "font-medium text-ink" : "text-mute hover:text-ink"
              }
            >
              {t(`userFilter.${s}`)}
            </Link>
          ))}
        </nav>
      </div>

      <form method="get" className="flex gap-2">
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
