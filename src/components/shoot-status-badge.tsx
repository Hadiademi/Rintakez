import { getTranslations } from "next-intl/server";

type ShootStatus = "open" | "assigned" | "completed" | "cancelled";

const statusColor: Record<ShootStatus, string> = {
  open: "border-ink text-ink",
  assigned: "border-accent text-accent",
  completed: "border-line text-mute",
  cancelled: "border-line text-mute-2",
};

/** Boxed status badge (Atelier style): bordered rectangle with a tracked label. */
export async function ShootStatusBadge({ status }: { status: ShootStatus }) {
  const t = await getTranslations("shoot");
  return (
    <span
      className={`label inline-block border px-2 py-1 ${statusColor[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
