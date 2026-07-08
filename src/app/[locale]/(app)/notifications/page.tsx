import { getNotificationsPage } from "@/lib/actions/notifications";
import { NotificationsList } from "@/components/notifications-list";

export const dynamic = "force-dynamic";

/**
 * Full notification history. The bell dropdown keeps only the 15 most recent;
 * this page pages through everything (30/page) and can mark all read. Auth is
 * inherited from the (app) layout's getProfile() gate, like /messages.
 */
export default async function NotificationsPage() {
  const { items, hasMore } = await getNotificationsPage({
    offset: 0,
    limit: 30,
  });

  return (
    <div className="mx-auto w-full max-w-2xl">
      <NotificationsList initialItems={items} initialHasMore={hasMore} />
    </div>
  );
}
