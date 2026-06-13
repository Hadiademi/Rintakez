"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient as createRealtimeClient } from "@supabase/supabase-js";
import { Link } from "@/i18n/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/actions/notifications";

// Unique storage key per realtime client so multiple instances never share an
// auth-storage lock (which would log "Multiple GoTrueClient instances").
let rtSeq = 0;

function hrefFor(item: NotificationItem): string {
  // Client (bid_received) → the shoot's offers. Photographer → their bids.
  if (item.type === "bid_received" && item.shootId)
    return `/shoots/${item.shootId}`;
  return "/my-bids";
}

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
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Realtime: live notifications for this user ─────────────────────
  useEffect(() => {
    // A dedicated realtime client seeded with the user's access token. The SSR
    // browser client does not reliably push its session token onto the realtime
    // socket, so we authorize this one explicitly (RLS on `notifications`
    // filters by auth.uid(), which requires the user token, not the anon key).
    const rt = createRealtimeClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      // Realtime-only client — we set the token via setAuth, so it must not
      // touch the shared auth storage (avoids "multiple GoTrueClient" warnings).
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: `sb-rt-notif-${++rtSeq}`,
        },
      }
    );

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
      rt.removeChannel(channel);
      rt.realtime.disconnect();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [userId]);

  // ── Close dropdown on outside click ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("title")}
        data-testid="notification-bell"
        className="press relative text-mute hover:text-ink"
      >
        <BellIcon />
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-paper"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 border border-line bg-paper shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="label text-mute">{t("title")}</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-[14px] text-mute">{t("empty")}</p>
          ) : (
            <ul className="max-h-96 overflow-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={hrefFor(item)}
                    onClick={() => setOpen(false)}
                    className={`block border-b border-line px-4 py-3 transition-colors hover:bg-surface ${
                      item.readAt ? "" : "bg-surface/60"
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      {!item.readAt && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      )}
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[14px] text-ink">
                          {t(item.type)}
                        </span>
                        {item.title && (
                          <span className="text-[13px] text-mute">
                            {item.title}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Realtime toast */}
      {toast && (
        <div
          data-testid="notification-toast"
          className="fixed right-5 top-20 z-[60] w-72 border border-line bg-ink px-4 py-3 text-paper shadow-xl"
        >
          <p className="label text-paper/60">{t("title")}</p>
          <Link
            href={hrefFor(toast)}
            onClick={() => setToast(null)}
            className="mt-1 block text-[14px] font-medium underline-offset-2 hover:underline"
          >
            {t(toast.type)}
          </Link>
        </div>
      )}
    </div>
  );
}
