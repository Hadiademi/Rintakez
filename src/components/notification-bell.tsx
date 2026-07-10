"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { getRealtimeClient } from "@/lib/supabase/realtime";
import {
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/actions/notifications";
import { hrefFor } from "@/lib/notifications-href";
import { NotificationTypeIcon } from "@/components/notification-type-icon";
import { NOTIFICATIONS_READ_EVENT } from "@/lib/notifications-events";

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function NotificationBell({
  userId,
  initialItems,
  initialUnread,
}: {
  userId: string;
  initialItems: NotificationItem[];
  initialUnread: number;
}) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  // Seed a stable reference time once at mount so relativeTime() never falls
  // back to the current instant on every render (which crashes next-intl's
  // ENVIRONMENT_FALLBACK guard when `now` is omitted).
  const [now] = useState(() => new Date());
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Realtime: live notifications for this user ─────────────────────
  useEffect(() => {
    // Shared realtime client (one websocket per tab), authorized with the user
    // token in the module. RLS on `notifications` filters by auth.uid(), which
    // requires the user token, not the anon key.
    const rt = getRealtimeClient();

    function onInsert(payload: { new: Record<string, unknown> }) {
      const row = payload.new as {
        id: string;
        type: NotificationItem["type"];
        shoot_id: string | null;
        read_at: string | null;
        created_at: string;
      };
      const item: NotificationItem = {
        id: row.id,
        type: row.type,
        shootId: row.shoot_id,
        // Realtime payload has no conversation id; the inbox is the fallback.
        conversationId: null,
        title: null,
        readAt: row.read_at,
        createdAt: row.created_at,
      };
      setItems((prev) => [item, ...prev].slice(0, 15));
      setUnread((u) => u + 1);
      setToast(item);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }

    const channel = rt.channel(`notif:${userId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      onInsert
    );

    let cancelled = false;
    (async () => {
      const { data } = await createBrowserClient().auth.getSession();
      if (cancelled || !data.session) return;
      await rt.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      // Remove only THIS channel — never disconnect the shared socket, which
      // other components' channels multiplex over.
      rt.removeChannel(channel);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [userId]);

  // ── Close dropdown on outside click or Escape ──────────────────────
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Zero the badge when notifications are marked read elsewhere (the full
  // /notifications page). The bell persists across app navigation, so it won't
  // re-seed its unread count on its own.
  useEffect(() => {
    function onRead() {
      setUnread(0);
      setItems((prev) =>
        prev.map((i) =>
          i.readAt ? i : { ...i, readAt: new Date().toISOString() }
        )
      );
    }
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) =>
        prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() }))
      );
      await markNotificationsRead();
    }
  }

  // Header "Mark all as read" — the same server action as opening the bell,
  // kept explicit so the affordance is discoverable. Broadcasts the read event
  // so the persistent /notifications list zeroes without a refetch.
  async function markAll() {
    setUnread(0);
    setItems((prev) =>
      prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() }))
    );
    await markNotificationsRead();
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("title")}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="notification-bell"
        className="press relative -m-2 flex h-10 w-10 items-center justify-center text-mute hover:text-ink"
      >
        <BellIcon />
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-paper"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 border border-line bg-paper shadow-lg lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[360px] lg:max-w-[calc(100vw-1.5rem)]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-base font-semibold text-ink">{t("title")}</p>
            <button
              type="button"
              onClick={markAll}
              data-testid="notification-mark-all"
              className="press label text-accent transition-opacity hover:opacity-70"
            >
              {t("markAllRead")}
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[14px] text-mute">
              {t("empty")}
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={hrefFor(item)}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line text-ink">
                      <NotificationTypeIcon type={item.type} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={`text-[14px] leading-snug ${
                          item.readAt ? "text-ink" : "font-medium text-ink"
                        }`}
                      >
                        {t(item.type)}
                      </span>
                      {item.title && (
                        <span className="truncate text-[13px] text-mute">
                          {item.title}
                        </span>
                      )}
                      <span className="label text-mute-2">
                        {(() => {
                          // Clamp to the mount reference: a realtime row's
                          // server timestamp can edge past `now`, which would
                          // otherwise render as a nonsensical "in X seconds".
                          const when = new Date(item.createdAt);
                          return format.relativeTime(when, when > now ? when : now);
                        })()}
                      </span>
                    </span>
                    {!item.readAt && (
                      <span
                        className="mt-1 h-2 w-2 shrink-0 bg-accent"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="press label flex min-h-11 items-center justify-center border-t border-line px-4 py-3 text-mute transition-colors hover:bg-surface hover:text-ink"
          >
            {t("viewAll")} &rarr;
          </Link>
        </div>
      )}

      {/* Realtime toast — the whole card navigates; a ✕ dismisses it. */}
      {toast && (
        <div
          data-testid="notification-toast"
          className="fixed right-5 top-20 z-[60] w-72 border border-line bg-ink text-paper shadow-xl"
        >
          <Link
            href={hrefFor(toast)}
            onClick={() => setToast(null)}
            className="press block px-4 py-3 pr-9"
          >
            <span className="label block text-paper/60">{t("title")}</span>
            <span className="mt-1 block text-[14px] font-medium">
              {t(toast.type)}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label={tCommon("close")}
            className="press absolute right-1 top-1 flex h-7 w-7 items-center justify-center text-paper/70 hover:text-paper"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
