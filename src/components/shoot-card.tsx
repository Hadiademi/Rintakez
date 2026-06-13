import { getTranslations } from "next-intl/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";

export type ShootCardData = {
  id: string;
  title: string;
  type: string;
  location_city: string;
  canton: string;
  shoot_date: string;
  duration_hours: number;
  budget_min_chf: number;
  budget_max_chf: number;
};

export async function ShootCard({ shoot }: { shoot: ShootCardData }) {
  const t = await getTranslations("shoot");
  return (
    <article className="border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="label text-mute">{t(`types.${shoot.type}`)}</span>
        <span className="label text-accent">{t("statusOpen")}</span>
      </div>
      <h3 className="mt-2 text-lg font-medium tracking-tight">{shoot.title}</h3>
      <dl className="mt-3 space-y-1 text-sm text-mute">
        <div className="flex justify-between">
          <dt>{t("location")}</dt>
          <dd className="text-ink">
            {shoot.location_city}, {shoot.canton}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("date")}</dt>
          <dd className="text-ink tabular">{formatSwissDate(shoot.shoot_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("budget")}</dt>
          <dd className="text-ink tabular">
            {formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
