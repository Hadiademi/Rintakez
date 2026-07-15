import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CoverImage } from "@/components/ui/cover-image";
import { formatChfAmount } from "@/lib/format";

export type PhotographerCardData = {
  id: string;
  name: string;
  city?: string | null;
  canton?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  verified?: boolean;
  disciplineLabels?: string[];
  specialtyLabels?: string[];
  rating?: { avg: number; count: number } | null;
  hourlyRate?: number | null;
  memberSinceYear?: number | null;
  isTopPartner?: boolean;
};

/** Neutral placeholder for photographers without a cover or portfolio image
 * yet — a tinted band with a quiet camera mark, not raw initials-on-gray. */
function CoverFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface via-chip to-surface">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        className="text-mute-2"
        aria-hidden="true"
      >
        <rect x="3" y="7" width="18" height="13" rx="1.5" />
        <path d="M8 7l1.6-2.5h4.8L16 7" />
        <circle cx="12" cy="13.5" r="3.5" />
      </svg>
    </div>
  );
}

/**
 * Portfolio-first photographer card for the directory and dashboard
 * recommendations. Leads with the photographer's work (cover, else first
 * portfolio image, else a quiet placeholder) so a photography marketplace
 * actually shows photography; the info below stays minimal — name, rating,
 * location/specialties, review count and starting rate.
 */
export async function PhotographerCard({
  data,
  verifiedLabel,
  newLabel,
  topPartnerLabel,
}: {
  data: PhotographerCardData;
  verifiedLabel: string;
  newLabel: string;
  topPartnerLabel: string;
}) {
  const tDir = await getTranslations("directory");
  const tReview = await getTranslations("review");
  const location = [data.city, data.canton].filter(Boolean).join(", ");
  const rated = !!data.rating && data.rating.count > 0;
  const tags = [
    ...(data.disciplineLabels ?? []),
    ...(data.specialtyLabels ?? []),
  ].slice(0, 4);
  const meta = [location, tags.join(", ")].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/photographers/${data.id}`}
      data-testid="photographer-card"
      className="group flex flex-col"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-chip">
        <CoverImage
          src={data.coverUrl}
          alt={data.name}
          fallback={<CoverFallback />}
          className="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 group-hover:grayscale-0 group-hover:scale-[1.02]"
        />
        {data.isTopPartner && (
          <span className="label absolute left-3 top-3 bg-paper/85 px-2 py-1 text-ink backdrop-blur">
            ★ {topPartnerLabel}
          </span>
        )}
        {data.verified && (
          <span className="label absolute right-3 top-3 bg-paper/85 px-2 py-1 text-accent backdrop-blur">
            ✓ {verifiedLabel}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line pt-3 transition-colors group-hover:border-mute-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium text-ink">{data.name}</p>
          {rated ? (
            <span className="tabular shrink-0 text-[13px] text-ink">
              ★ {data.rating!.avg.toFixed(1)}
            </span>
          ) : (
            <span className="label shrink-0 text-mute-2">{newLabel}</span>
          )}
        </div>

        {meta && <p className="truncate text-[13px] text-mute">{meta}</p>}

        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="label text-mute-2">
            {tReview("count", { count: data.rating?.count ?? 0 })}
          </span>
          {data.hourlyRate != null && (
            <span className="tabular text-[13px] text-mute">
              {tDir("fromPrice", { amount: formatChfAmount(data.hourlyRate) })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
