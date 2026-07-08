"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  getNotificationsPage,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/actions/notifications";
import { hrefFor } from "@/lib/notifications-href";
import { NOTIFICATIONS_READ_EVENT } from "@/lib/notifications-events";
import { formatMessageTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationTypeIcon } from "@/components/notification-type-icon";

const PAGE_SIZE = 30;

/** Local-date bucket key (YYYY-M-D) so day separators follow the viewer's
 *  timezone rather than the UTC calendar day the DB stored. Mirrors the chat. */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function NotificationsList({
  initialItems,
  initialHasMore,
}: {
  initialItems: NotificationItem[];
  initialHasMore: boolean;
}) {
  const t = useTranslations("notifications");
  const format = useFormatter();

  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  // "Today"/"yesterday" local-day keys, seeded once at mount (mirrors the chat).
  const [{ todayKey, yesterdayKey }] = useState(() => ({
    todayKey: localDayKey(new Date().toISOString()),
    yesterdayKey: localDayKey(new Date(Date.now() - 86_400_000).toISOString()),
  }));

  const hasUnread = items.some((i) => !i.readAt);

  function dayLabel(iso: string): string {
    const key = localDayKey(iso);
    if (key === todayKey) return t("today");
    if (key === yesterdayKey) return t("yesterday");
    return format.dateTime(new Date(iso), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  async function onLoadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await getNotificationsPage({
        offset: items.length,
        limit: PAGE_SIZE,
      });
      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        const fresh = res.items.filter((i) => !ids.has(i.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
  }

  async function onMarkAll() {
    if (marking || !hasUnread) return;
    setMarking(true);
    // Optimistic: clear the highlight immediately.
    setItems((prev) =>
      prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() }))
    );
    try {
      await markNotificationsRead();
      // Let the persistent bell zero its badge without a full refetch.
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("heading")}
        </h1>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={marking}
            data-testid="mark-all-read"
            className="press flex min-h-11 items-center rounded-full border border-line px-3.5 text-[13px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState description={t("empty")} />
      ) : (
        <>
          <ul className="border-y border-line">
            {items.map((item, i) => {
              const prev = items[i - 1];
              const showDay =
                !prev ||
                localDayKey(prev.createdAt) !== localDayKey(item.createdAt);
              const unread = !item.readAt;
              return (
                <li key={item.id}>
                  {showDay && (
                    <div className="bg-surface/40 px-1 py-2">
                      <span className="label text-mute-2">
                        {dayLabel(item.createdAt)}
                      </span>
                    </div>
                  )}
                  <Link
                    href={hrefFor(item)}
                    className={`flex min-h-11 items-start gap-3 border-t border-line px-1 py-3 transition-colors hover:bg-surface ${
                      unread ? "bg-surface/60" : ""
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chip text-mute">
                      <NotificationTypeIcon type={item.type} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-start gap-2">
                        {unread && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        )}
                        <span
                          className={`text-[14px] ${unread ? "font-medium text-ink" : "text-ink"}`}
                        >
                          {t(item.type)}
                        </span>
                      </span>
                      {item.title && (
                        <span className="truncate text-[13px] text-mute">
                          {item.title}
                        </span>
                      )}
                    </span>
                    <time
                      dateTime={item.createdAt}
                      className="shrink-0 pt-0.5 text-[12px] text-mute-2"
                    >
                      {formatMessageTime(item.createdAt)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loading}
                data-testid="load-more"
                className="press rounded-full border border-line px-4 py-2 text-[13px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
              >
                {t("loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
