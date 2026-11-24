import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { adminPageClient } from "@/lib/admin/guard";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminShootActions } from "@/components/admin-shoot-actions";
import { getShootCoverUrls } from "@/lib/shoot-cover";
import { formatSwissDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "open", "suspended"] as const;
type Filter = (typeof FILTERS)[number];

const LIMIT = 50;

/**
 * Every shoot, newest first, with the admin's moderation controls. Reads with
 * the service role (adminPageClient proves the caller is an admin first), so
 * suspended shoots — invisible everywhere else — are listed here too, which is
 * where their suspension is lifted again.
 */
export default async function AdminShootsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter: filterParam } = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(filterParam ?? "")
    ? (filterParam as Filter)
    : "all";

  const [t, tShoot] = await Promise.all([
    getTranslations("admin"),
    getTranslations("shoot"),
  ]);
  const admin = await adminPageClient();
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  let query = admin
    .from("shoots")
    .select(
      "id, title, status, is_suspended, shoot_date, location_city, canton, client_id, accepted_bid_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (filter === "open") query = query.eq("status", "open").eq("is_suspended", false);
  if (filter === "suspended") query = query.eq("is_suspended", true);
  if (q?.trim()) query = query.ilike("title", `%${q.trim()}%`);

  const { data: rows } = await query;
  const list = rows ?? [];
  const ids = list.map((s) => s.id);
  const clientIds = [...new Set(list.map((s) => s.client_id))];

  const [covers, { data: clients }] = await Promise.all([
    getShootCoverUrls(admin, ids),
    clientIds.length > 0
      ? admin.from("profiles").select("id, display_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.display_name]));

  return (
    <section className="space-y-4">
      <AdminPageHeader eyebrow={t("eyebrowManagement")} title={t("tabShoots")} />
      <nav className="flex flex-wrap gap-3 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/shoots?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={f === filter ? "page" : undefined}
            className={f === filter ? "font-medium text-ink" : "text-mute hover:text-ink"}
          >
            {t(`shootFilter.${f}`)}
          </Link>
        ))}
      </nav>

      <form method="get" className="flex gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchShoots")}
          aria-label={t("searchShoots")}
          className="min-w-0 flex-1 border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none sm:text-sm"
        />
        <button type="submit" className="press border border-line px-4 py-2 text-sm text-ink">
          {t("search")}
        </button>
      </form>

      {list.length === 0 ? (
        <p className="text-mute">{t("noShoots")}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => {
            const cover = covers.get(s.id);
            return (
              <li
                key={s.id}
                data-testid={`admin-shoot-${s.id}`}
                className="grid gap-4 border border-line bg-surface p-4 sm:grid-cols-[72px_1fr_minmax(0,300px)]"
              >
                <div className="h-[72px] w-[72px] shrink-0 overflow-hidden bg-line">
                  {cover ? (
                    // Signed, short-lived URL of a private upload: a plain <img>
                    // avoids caching it in the image optimiser.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.is_suspended ? (
                      <span className="font-medium text-ink">{s.title}</span>
                    ) : (
                      <Link
                        href={`/shoots/${s.id}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {s.title}
                      </Link>
                    )}
                    <span className="label border border-line px-1.5 py-0.5 text-mute">
                      {tShoot(`status.${s.status}`)}
                    </span>
                    {s.is_suspended && (
                      <span className="label border border-accent px-1.5 py-0.5 text-accent">
                        {t("suspended")}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-mute">
                    {formatSwissDate(s.shoot_date)} · {s.location_city}, {s.canton} ·{" "}
                    {t("shootBy", { name: clientName.get(s.client_id) ?? "—" })}
                  </p>
                </div>
                <AdminShootActions
                  id={s.id}
                  title={s.title}
                  isSuspended={s.is_suspended}
                  deletable={!s.accepted_bid_id}
                />
              </li>
            );
          })}
        </ul>
      )}
      {list.length === LIMIT ? (
        <p className="label text-mute-2">{t("resultsCapped", { n: LIMIT })}</p>
      ) : null}
    </section>
  );
}
