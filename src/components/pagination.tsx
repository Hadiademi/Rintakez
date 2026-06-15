import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Locale-aware, JS-free pagination. Renders prev/next links plus a "page X of Y"
 * status. `params` are the current search params (minus `page`) so links
 * preserve active filters; `basePath` is the locale-relative route (e.g.
 * "/shoots"). Returns null for a single page.
 */
export async function Pagination({
  page,
  totalPages,
  params,
  basePath,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  const t = await getTranslations("pagination");

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkClass =
    "press inline-flex h-10 min-w-10 items-center justify-center border border-line px-4 text-base text-ink transition-colors hover:border-mute-2";
  const disabledClass =
    "inline-flex h-10 min-w-10 items-center justify-center border border-line px-4 text-base text-mute-2 opacity-50";

  return (
    <nav
      aria-label={t("label")}
      data-testid="pagination"
      className="flex items-center justify-center gap-3 pt-6"
    >
      {page <= 1 ? (
        <span className={disabledClass} aria-disabled="true">
          ‹
        </span>
      ) : (
        <Link href={href(page - 1)} aria-label={t("prev")} className={linkClass}>
          ‹
        </Link>
      )}

      <span className="label tabular text-mute">
        {t("status", { page, total: totalPages })}
      </span>

      {page >= totalPages ? (
        <span className={disabledClass} aria-disabled="true">
          ›
        </span>
      ) : (
        <Link href={href(page + 1)} aria-label={t("next")} className={linkClass}>
          ›
        </Link>
      )}
    </nav>
  );
}
