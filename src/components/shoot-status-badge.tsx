import { getTranslations } from "next-intl/server";

type ShootStatus = "open" | "assigned" | "completed" | "cancelled";

const statusColor: Record<ShootStatus, string> = {
  open: "text-accent",
  assigned: "text-ink",
  completed: "text-mute",
  cancelled: "text-mute-2",
};

export async function ShootStatusBadge({ status }: { status: ShootStatus }) {
  const t = await getTranslations("shoot");
  return (
    <span className={`label ${statusColor[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}
