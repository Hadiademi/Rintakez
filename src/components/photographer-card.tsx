import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { CoverImage } from "@/components/ui/cover-image";
import { Stars } from "@/components/stars";
import { initials } from "@/lib/name";
import { formatCHF } from "@/lib/format";

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

/**
 * Image-led photographer card for the directory and dashboard recommendations.
 * Leads with the photographer's work (cover, else first portfolio image, else a
 * tinted monogram band) so a photography marketplace actually shows photography.
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
  const tShoot = await getTranslations("shoot");
  const tProfile = await getTranslations("profile");
  const location = [data.city, data.canton].filter(Boolean).join(", ");
  const rated = data.rating && data.rating.count > 0;
  const disciplines = data.disciplineLabels ?? [];
  const specialties = data.specialtyLabels ?? [];
  const memberSince = data.memberSinceYear
    ? tProfile("memberSince", { year: data.memberSinceYear })
    : null;

  return (
    <Link
      href={`/photographers/${data.id}`}
      data-testid="photographer-card"
      className="group flex flex-col overflow-hidden border border-line transition-colors hover:border-mute-2"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-chip">
        <CoverImage
          src={data.coverUrl}
          alt={data.name}
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface via-chip to-surface">
              <span className="text-4xl font-semibold text-mute-2">
                {initials(data.name)}
              </span>
            </div>
          }
          className="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 group-hover:grayscale-0 group-hover:scale-[1.02]"
        />
        {data.verified && (
          <span className="label absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-paper/90 px-2 py-1 text-accent backdrop-blur">
            ✓ {verifiedLabel}
          </span>
        )}
        {data.isTopPartner && (
          <span className="label absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-paper/90 px-2 py-1 text-ink backdrop-blur">
            ★ {topPartnerLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={data.name} src={data.avatarUrl} size={36} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{data.name}</p>
            {(location || memberSince) && (
              <p className="truncate text-[13px] text-mute">
                {[location, memberSince].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {(disciplines.length > 0 || specialties.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {disciplines.map((d) => (
              <span
                key={d}
                className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-mute"
              >
                {d}
              </span>
            ))}
            {specialties.slice(0, 3).map((s) => (
              <span
                key={s}
                className="rounded-full bg-chip px-2.5 py-0.5 text-[12px] text-ink"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          {rated ? (
            <span className="flex items-center gap-1.5">
              <Stars value={data.rating!.avg} size={12} />
              <span className="tabular text-[12px] text-mute">
                {data.rating!.avg.toFixed(1)}
              </span>
            </span>
          ) : (
            <span className="label text-mute-2">{newLabel}</span>
          )}
          {data.hourlyRate != null && (
            <span className="tabular text-[13px] text-mute">
              {formatCHF(data.hourlyRate)}
              {tShoot("perHour")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
