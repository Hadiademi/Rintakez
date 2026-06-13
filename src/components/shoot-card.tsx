import { getTranslations } from "next-intl/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";

export type ShootCardData = {
  id: string;
  title: string;
  type: string;
  location_city: string;
  canton: string;
  shoot_date: string;
  duration_hours?: number;
  budget_min_chf: number;
  budget_max_chf: number;
};

/** Editorial shoot card (Atelier browse style): grayscale cover, uppercase meta,
 *  large title, CHF range, and an optional boxed offer count. */
export async function ShootCard({
  shoot,
  offersCount,
}: {
  shoot: ShootCardData;
  offersCount?: number;
}) {
  const t = await getTranslations("shoot");
  const tShoot = await getTranslations("shoot");

  const meta = [
    shoot.location_city,
    formatSwissDate(shoot.shoot_date),
    shoot.duration_hours ? `${shoot.duration_hours} STD` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group">
      {/* Grayscale cover — grey placeholder when the shoot has no image (per design) */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-chip">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="label text-mute-2">{t(`types.${shoot.type}`)}</span>
        </div>
      </div>

      <div className="mt-3">
        <p className="label uppercase text-mute">{meta}</p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-ink">
          {shoot.title}
        </h3>
        <p className="mt-1 tabular text-ink">
          {formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf)}
        </p>
        {offersCount !== undefined && (
          <p className="label mt-2 text-mute">
            {tShoot("bidsCount", { count: offersCount })}
          </p>
        )}
      </div>
    </article>
  );
}
