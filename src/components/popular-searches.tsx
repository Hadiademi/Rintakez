import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cantonName } from "@/lib/canton-names";
import type { CantonTypeCombo } from "@/lib/photographer-landing-combos";

/**
 * Compact internal-link block surfacing the top canton x shoot-type
 * programmatic landing pages (see
 * `[locale]/(app)/photographers/[canton]/[type]/page.tsx`). Placed on the
 * directory page so crawlers (and visitors) can discover these pages without
 * needing the sitemap — the "Popular searches" pattern used by most classifieds
 * / marketplace sites for the same reason.
 */
export async function PopularSearches({
  combos,
  locale,
  limit = 8,
}: {
  combos: CantonTypeCombo[];
  locale: string;
  limit?: number;
}) {
  if (combos.length === 0) return null;

  const t = await getTranslations("directory");
  const tSeo = await getTranslations("landingSeo");

  const top = [...combos]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  if (top.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-line pt-6">
      <p className="label text-mute">{t("popularSearches")}</p>
      <div className="flex flex-wrap gap-2">
        {top.map(({ canton, type }) => (
          <Link
            key={`${canton}-${type}`}
            href={`/photographers/${canton}/${type}`}
            className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink transition-colors hover:border-mute-2"
          >
            {tSeo(`h1.${type}`, { canton: cantonName(canton, locale) })}
          </Link>
        ))}
      </div>
    </div>
  );
}
