import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { shootImage } from "@/lib/shoot-image";

export type ShootCardData = {
  id: string;
  title: string;
  type: string;
  discipline?: string;
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
  const tShoot = await getTranslations("shoot");

  const meta = [
    shoot.discipline ? tShoot(`disciplines.${shoot.discipline}`) : null,
    shoot.location_city,
    formatSwissDate(shoot.shoot_date),
    shoot.duration_hours ? `${shoot.duration_hours} STD` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group">
      {/* Grayscale editorial cover */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-chip">
        <Image
          src={shootImage(shoot.type, shoot.id, 900, 600)}
          alt={shoot.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover grayscale transition-[filter,transform] duration-500 group-hover:grayscale-0 group-hover:scale-[1.02]"
        />
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
