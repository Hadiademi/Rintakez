"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { getRealtimeClient } from "@/lib/supabase/realtime";
import {
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/actions/notifications";
import { hrefFor } from "@/lib/notifications-href";
import { NotificationTypeIcon } from "@/components/notification-type-icon";
import { NOTIFICATIONS_READ_EVENT } from "@/lib/notifications-events";
import {
  applyCountPrefix,
  pageShowsIt,
  shouldRefreshFor,
} from "@/lib/live-updates";
import { useToast, type ToastOptions } from "@/components/ui/toaster";

/** Good news gets the check; everything else (a review can be 1★) is info. */
const SUCCESS_TYPES = new Set<NotificationItem["type"]>([
  "bid_accepted",
  "verification_approved",
]);

type Details = Pick<NotificationItem, "title" | "conversationId">;

// Both bells (desktop + mobile) receive every row; they share one lookup per
// notification instead of querying twice.
const detailsCache = new Map<string, Promise<Details>>();

/** The realtime row carries ids only: resolve the shoot title (and, for a
 *  message, its conversation) so the list and the toast can name it. */
function lookupDetails(item: NotificationItem): Promise<Details> {
  const hit = detailsCache.get(item.id);
  if (hit) return hit;
  const shootId = item.shootId;
  const pending: Promise<Details> = shootId
    ? (async () => {
        const supabase = createBrowserClient();
        const [{ data: shoot }, { data: conv }] = await Promise.all([
          supabase.from("shoots").select("title").eq("id", shootId).maybeSingle(),
          item.type === "message_received"
            ? supabase
                .from("conversations")
                .select("id")
                .eq("shoot_id", shootId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        return { title: shoot?.title ?? null, conversationId: conv?.id ?? null };
      })()
    : Promise.resolve({ title: null, conversationId: null });
  detailsCache.set(item.id, pending);
  return pending;
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
  announce = false,
}: {
  userId: string;
  initialItems: NotificationItem[];
  initialUnread: number;
  /**
   * The nav renders a bell for each breakpoint; exactly one announces —
   * toasts the live notification, refreshes the page it makes stale and puts
   * the unread count in the tab title — so nothing happens twice.
   */
  announce?: boolean;
}) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  // Seed a stable reference time once at mount so relativeTime() never falls
  // back to the current instant on every render (which crashes next-intl's
  // ENVIRONMENT_FALLBACK guard when `now` is omitted).
  const [now] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The realtime handler is set up once per user; it reads the latest
  // page / translator / toast through refs instead of re-subscribing.
  const live = useRef({ announce, pathname, router, toast, t });
  useEffect(() => {
    live.current = { announce, pathname, router, toast, t };
  });

  // ── Realtime: live notifications for this user ─────────────────────
  useEffect(() => {
    // Shared realtime client (one websocket per tab), authorized with the user
    // token in the module. RLS on `notifications` filters by auth.uid(), which
    // requires the user token, not the anon key.
    const rt = getRealtimeClient();
    let cancelled = false;

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
      void enrichAndAnnounce(item);
    }

    async function enrichAndAnnounce(item: NotificationItem) {
      const details = await lookupDetails(item);
      if (cancelled) return;
      const enriched = { ...item, ...details };
      // Merge only the looked-up fields: the bell may have marked the row
      // read while the lookup ran.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...details } : i)));

      const { announce, pathname, toast, t } = live.current;
      if (!announce) return;
      // No toast when the page already says it: reading the messages, or on
      // the page the refresh below updates with its own feedback (the offer
      // appears marked "new", the won / verified moment opens).
      const reading =
        enriched.type === "message_received" && pathname.startsWith("/messages");
      if (!reading && !pageShowsIt(pathname, enriched.type, enriched.shootId)) {
        const options: ToastOptions = {
          variant: SUCCESS_TYPES.has(enriched.type) ? "success" : "info",
          description: enriched.title ?? undefined,
          action: { label: t("view"), href: hrefFor(enriched) },
        };
        toast(t(enriched.type), options);
      }
      // Bring the open page up to date — debounced for bursts, and checked
      // again when it fires, in case the user moved on to a form meanwhile.
      if (shouldRefreshFor(pathname, enriched.shootId)) {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => {
          const now = live.current;
          if (shouldRefreshFor(now.pathname, enriched.shootId)) now.router.refresh();
        }, 400);
      }
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
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [userId]);

  // Unread count in the tab title — "(2) Framly" — and on the installed
  // app's icon. Next rewrites <title> on navigation, so re-apply whenever the
  // head changes (idempotent, so it never loops).
  const titlePrefix = useRef("");
  useEffect(() => {
    if (!announce) return;
    const apply = () => {
      const next = applyCountPrefix(document.title, titlePrefix.current, unread);
      titlePrefix.current = next.prefix;
      if (document.title !== next.title) document.title = next.title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    const nav = appBadgeNavigator();
    (unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.())?.catch(() => {});
    return () => observer.disconnect();
  }, [announce, unread]);

  // Leaving the app shell (sign-out): take the count off the title and icon.
  useEffect(() => {
    if (!announce) return;
    return () => {
      document.title = applyCountPrefix(document.title, titlePrefix.current, 0).title;
      titlePrefix.current = "";
      appBadgeNavigator().clearAppBadge?.()?.catch(() => {});
    };
  }, [announce]);

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
      // The other breakpoint's bell (which may be the one announcing the
      // count in the tab title) must zero too.
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
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
        <div className="fixed right-3 top-16 z-50 w-[calc(100vw-1.5rem)] max-w-sm border border-line bg-paper shadow-lg lg:absolute lg:right-0 lg:top-full lg:mt-2 lg:w-[360px] lg:max-w-[calc(100vw-1.5rem)]">
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
    </div>
  );
}

/** Badging API (installed PWA icon); absent in most desktop browsers. */
function appBadgeNavigator() {
  return navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
}
