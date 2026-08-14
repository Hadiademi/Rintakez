"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { getRealtimeClient } from "@/lib/supabase/realtime";
import { downscaleImage } from "@/lib/image-downscale";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { ReportButton } from "@/components/report-button";
import {
  sendMessage,
  sendImageMessage,
  getMessageImageUrl,
  markConversationRead,
  getThread,
  loadEarlierMessages,
  blockUser,
  unblockUser,
  type ThreadData,
  type ThreadMessage,
} from "@/lib/actions/messages";
import { errorKey } from "@/lib/error-messages";

/** A message as held in local state: a server row plus an optional optimistic
 *  status. `sending`/`failed` messages only ever originate from the local user
 *  and carry a temporary `id` (`temp-…`) until the server row reconciles in.
 *  `error` holds the localized failure reason shown on a failed bubble. */
type LocalMessage = ThreadMessage & {
  status?: "sending" | "failed";
  error?: string;
  /** Object URL of a just-picked/compressed image, shown instantly on the
   *  optimistic bubble before (and after) the signed URL resolves. */
  localPreviewUrl?: string;
};

/** Group boundary: same sender within this window renders as one visual block. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** How close to the bottom (px) still counts as "following along". */
const NEAR_BOTTOM_PX = 120;
/** Upload ceiling after client-side downscale (mirrors the server check). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Longest edge (px) and JPEG quality for the pre-upload canvas downscale —
 *  keeps uploads fast on mobile data without visibly degrading a chat photo. */
const MAX_IMAGE_DIM = 2000;
const IMAGE_QUALITY = 0.85;

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/** Local-date bucket key (YYYY-M-D) so day separators follow the viewer's
 *  timezone rather than the UTC calendar day the DB stored. */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function newTempId(): string {
  return `temp-${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;
}

export function MessageThread({ thread }: { thread: ThreadData }) {
  const t = useTranslations("messages");
  const tErr = useTranslations("errors");
  const format = useFormatter();

  const [messages, setMessages] = useState<LocalMessage[]>(thread.messages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [iBlocked, setIBlocked] = useState(thread.iBlocked);
  const [blocking, setBlocking] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  // Pagination: whether an older page exists (see loadEarlierMessages), and
  // whether that page is currently being fetched.
  const [hasMore, setHasMore] = useState(thread.hasMore);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // Photo attachments: a validation error for the picker, and the currently
  // open lightbox image source (null = closed).
  const [imageError, setImageError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // "Today"/"yesterday" local-day keys, seeded once at mount (a chat session
  // won't outlive a midnight rollover in practice). Lazy initializers are the
  // sanctioned place for the otherwise-impure `Date` reads.
  const [{ todayKey, yesterdayKey }] = useState(() => ({
    todayKey: localDayKey(new Date().toISOString()),
    yesterdayKey: localDayKey(new Date(Date.now() - 86_400_000).toISOString()),
  }));

  // The other party's last-read timestamp. Seeded from the initial load and
  // then kept live by a conversations-row UPDATE listener (see the realtime
  // effect below), so a ✓ flips to ✓✓ the instant they read — no reopen needed.
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(
    thread.otherLastReadAt
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  // Latest near-bottom flag, mirrored into a ref so the new-message effect and
  // the realtime callback read a fresh value without re-subscribing.
  const atBottomRef = useRef(true);
  // Enter-to-send only on fine pointers (mouse/trackpad). Computed once, SSR-safe.
  const finePointerRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);

  useEffect(() => {
    finePointerRef.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: fine)").matches;
    prefersReducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Merge any messages we don't already have (by id), preserving order. Used by
  // the realtime self-heal path after a reconnect.
  const mergeMessages = useCallback((incoming: ThreadMessage[]) => {
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !ids.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  // Prepend an older page (already ascending) ahead of what's loaded, deduped
  // by id. Older pages never race the realtime append (which only ever adds
  // at the end), so this is a plain merge-at-the-front.
  const prependMessages = useCallback((older: ThreadMessage[]) => {
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const fresh = older.filter((m) => !ids.has(m.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, []);

  // Fetch (participant-gated) and slot in a signed URL for a message's image.
  // Stable: only touches setMessages + the server action.
  const resolveImageUrl = useCallback(async (id: string) => {
    const res = await getMessageImageUrl(id);
    if (res?.url)
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, imageUrl: res.url } : m))
      );
  }, []);

  // The other side blocked me, or I blocked them → no new messages either way.
  const composerDisabled = iBlocked || thread.blockedByThem;

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Load the previous page of older messages, anchoring the scroll position on
  // the message the user was already looking at. We capture scrollHeight
  // before the DOM grows and restore scrollTop by the same delta after, so the
  // viewport doesn't jump — jumping to top or bottom would lose the user's
  // place mid-history.
  async function onLoadEarlier() {
    if (loadingEarlier || !hasMore || messages.length === 0) return;
    setLoadingEarlier(true);
    const oldest = messages[0];
    const el = scrollerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;
    try {
      const res = await loadEarlierMessages(
        thread.id,
        oldest.createdAt,
        oldest.id
      );
      if (!res) {
        setHasMore(false);
        return;
      }
      if (res.messages.length > 0) {
        prependMessages(res.messages);
        // Restore the anchor after the DOM has grown with the prepended rows.
        requestAnimationFrame(() => {
          const node = scrollerRef.current;
          if (!node) return;
          const delta = node.scrollHeight - prevScrollHeight;
          node.scrollTop = prevScrollTop + delta;
        });
      }
      setHasMore(res.hasMore);
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function onToggleBlock() {
    if (blocking) return;
    setBlocking(true);
    const res = iBlocked
      ? await unblockUser(thread.otherId)
      : await blockUser(thread.otherId);
    if (res.ok) setIBlocked((v) => !v);
    setBlocking(false);
  }

  // Mark read on open.
  useEffect(() => {
    markConversationRead(thread.id);
  }, [thread.id]);

  // Realtime: new messages in this conversation.
  useEffect(() => {
    // Shared realtime client (one websocket per tab); this thread opens its own
    // channel on it. Token is set/refreshed in the module.
    const rt = getRealtimeClient();
    const channel = rt.channel(`thread:${thread.id}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${thread.id}`,
      },
      (payload) => {
        const m = payload.new as {
          id: string;
          sender_id: string;
          body: string;
          created_at: string;
          image_path: string | null;
        };
        setMessages((prev) => {
          // Already have the server row (e.g. reconciled from onSend) → skip.
          if (prev.some((x) => x.id === m.id)) return prev;
          // My own echo may beat the send action's response back: reconcile the
          // oldest still-sending temp bubble instead of appending a duplicate.
          // Match an image echo to a sending bubble carrying a local preview
          // (bodies are empty for image-only), a text echo by matching body.
          if (m.sender_id === thread.meId) {
            const tempIdx = prev.findIndex((x) =>
              x.status === "sending" &&
              (m.image_path ? !!x.localPreviewUrl : x.body === m.body)
            );
            if (tempIdx !== -1) {
              const next = prev.slice();
              next[tempIdx] = {
                id: m.id,
                senderId: m.sender_id,
                body: m.body,
                createdAt: m.created_at,
                imagePath: m.image_path,
                // Keep the already-loaded local preview so the bubble doesn't
                // flash while a signed URL would re-fetch the same bytes.
                imageUrl: null,
                localPreviewUrl: prev[tempIdx].localPreviewUrl,
              };
              return next;
            }
          }
          return [
            ...prev,
            {
              id: m.id,
              senderId: m.sender_id,
              body: m.body,
              createdAt: m.created_at,
              imagePath: m.image_path,
              imageUrl: null,
            },
          ];
        });
        if (m.sender_id !== thread.meId) {
          markConversationRead(thread.id);
          // Their message landed while we were scrolled up → surface the pill.
          // (Our own messages always auto-scroll, so never raise it for those.)
          if (!atBottomRef.current) setHasNew(true);
          // Incoming image: the payload has the path but not a signed URL —
          // fetch one (participant-gated) and slot it in once resolved.
          if (m.image_path) void resolveImageUrl(m.id);
        }
      }
    ).on(
      // Live read receipts: when the counterparty marks this conversation read
      // (mark_conversation_read stamps their *_last_read_at), reflect it so my
      // sent ✓ flips to ✓✓ without reopening. REPLICA IDENTITY FULL delivers
      // client_id, so we can pick the counterparty's column: if the OTHER party
      // is the client, their marker is client_last_read_at, else photographer's.
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `id=eq.${thread.id}`,
      },
      (payload) => {
        const row = payload.new as {
          client_id: string;
          photographer_id: string;
          client_last_read_at: string | null;
          photographer_last_read_at: string | null;
        };
        const otherReadAt =
          row.client_id === thread.otherId
            ? row.client_last_read_at
            : row.photographer_last_read_at;
        // Monotonic: never move the receipt backwards on an out-of-order event.
        setOtherLastReadAt((prev) =>
          otherReadAt && (!prev || otherReadAt > prev) ? otherReadAt : prev
        );
      }
    );

    let cancelled = false;
    (async () => {
      const { data } = await createBrowserClient().auth.getSession();
      if (cancelled || !data.session) return;
      await rt.realtime.setAuth(data.session.access_token);
      channel.subscribe(async (status) => {
        // Self-heal: after mobile backgrounding the access token can expire and
        // the socket drop. On error/timeout, refresh the token and re-sync any
        // messages missed while disconnected so nothing silently vanishes.
        if (
          cancelled ||
          (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT")
        )
          return;
        const { data: s } = await createBrowserClient().auth.getSession();
        if (s.session) await rt.realtime.setAuth(s.session.access_token);
        const fresh = await getThread(thread.id);
        if (!cancelled && fresh) mergeMessages(fresh.messages);
      });
    })();

    return () => {
      cancelled = true;
      // Remove only THIS channel — never disconnect the shared socket, which
      // other components' channels multiplex over.
      rt.removeChannel(channel);
    };
  }, [thread.id, thread.meId, thread.otherId, mergeMessages, resolveImageUrl]);

  const lastMessage = messages[messages.length - 1];
  const lastId = lastMessage?.id;
  const lastMine = lastMessage?.senderId === thread.meId;

  // Track whether the scroller is near the bottom. Catching up to the bottom
  // clears the "new messages" pill; `hasNew` is only ever *raised* from event
  // sources (realtime INSERT), never from an effect.
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance <= NEAR_BOTTOM_PX;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setHasNew(false);
  }, []);

  // Smart auto-scroll. First paint jumps instantly to the latest message
  // (never smooth-scrolls the whole history open). Afterward, auto-scroll only
  // when the user is already near the bottom OR the newest message is mine.
  // This effect only touches the DOM (imperative scroll) — no setState — so it
  // stays clear of the cascading-render rule; the pill is raised elsewhere.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      scrollToBottom("auto");
      return;
    }
    if (atBottomRef.current || lastMine) {
      scrollToBottom(prefersReducedMotionRef.current ? "auto" : "smooth");
    }
    // Keyed on lastId (a new message). lastMine/atBottom read fresh (ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, scrollToBottom]);

  // Pill shows only while a raised "new messages" flag coincides with being
  // scrolled up; catching up (onScroll) or tapping it clears the flag.
  const showPill = hasNew && !atBottom;

  async function onSend() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);

    // Optimistic: show the bubble immediately, before the round-trip. The text
    // now lives in the bubble, so we can clear the composer without risk of
    // losing it — a failed send stays retryable from the bubble itself.
    const tempId = newTempId();
    const optimistic: LocalMessage = {
      id: tempId,
      senderId: thread.meId,
      body: text,
      createdAt: new Date().toISOString(),
      imagePath: null,
      imageUrl: null,
      status: "sending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setHasNew(false); // my own send auto-scrolls to the bottom
    if (taRef.current) taRef.current.style.height = "auto";

    try {
      const res = await sendMessage(thread.id, { body: text });
      reconcile(tempId, res);
    } catch {
      markFailed(tempId, tErr("generic"));
    } finally {
      setSending(false);
      // Refocus so the user can keep typing after either outcome.
      taRef.current?.focus();
    }
  }

  // Turn a send result into state: reconcile the temp bubble to the server row
  // on success (deduping against a realtime echo that may already have landed),
  // or flag it failed with a localized reason. Shared by send + retry paths.
  function reconcile(
    tempId: string,
    res: Awaited<ReturnType<typeof sendMessage>>
  ) {
    if (res.ok) {
      const server = res.message;
      setMessages((prev) =>
        prev.some((m) => m.id === server.id)
          ? prev.filter((m) => m.id !== tempId) // realtime echo already added it
          : prev.map((m) => (m.id === tempId ? server : m))
      );
    } else {
      // Friendly copy for the rate limit; the generic key otherwise.
      markFailed(
        tempId,
        res.error === "limit_reached"
          ? t("limitReached")
          : tErr(errorKey(res.error))
      );
    }
  }

  function markFailed(tempId: string, error: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, status: "failed", error } : m
      )
    );
  }

  // Pick → downscale → optimistic bubble → upload. Reuses the sending-status
  // machinery: the bubble shows a spinner over the local preview until the
  // server confirms, then reconciles to the real row (keeping the preview so
  // the image never flashes).
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError(t("imageInvalid"));
      return;
    }

    setSending(true);
    const blob = await downscaleImage(file, MAX_IMAGE_DIM, IMAGE_QUALITY);
    if (blob.size > MAX_IMAGE_BYTES) {
      setImageError(t("imageTooLarge"));
      setSending(false);
      return;
    }

    const previewUrl = URL.createObjectURL(blob);
    const tempId = newTempId();
    const optimistic: LocalMessage = {
      id: tempId,
      senderId: thread.meId,
      body: "",
      createdAt: new Date().toISOString(),
      imagePath: null,
      imageUrl: null,
      status: "sending",
      localPreviewUrl: previewUrl,
    };
    setMessages((prev) => [...prev, optimistic]);
    setHasNew(false); // my own send auto-scrolls to the bottom

    try {
      const fd = new FormData();
      fd.append("file", blob, "photo.jpg");
      const res = await sendImageMessage(thread.id, fd);
      if (res.ok) {
        // Keep the already-loaded preview to avoid a flash; the signed URL is a
        // fallback once the object URL is revoked on unmount/discard.
        setMessages((prev) =>
          prev.some((m) => m.id === res.message.id)
            ? prev.filter((m) => m.id !== tempId) // realtime echo already added it
            : prev.map((m) =>
                m.id === tempId
                  ? { ...res.message, localPreviewUrl: previewUrl }
                  : m
              )
        );
      } else {
        markFailed(
          tempId,
          res.error === "limit_reached"
            ? t("limitReached")
            : tErr(errorKey(res.error))
        );
      }
    } catch {
      markFailed(tempId, tErr("generic"));
    } finally {
      setSending(false);
    }
  }

  // Retry a failed message: flip it back to sending and re-run the round-trip.
  // Re-entrancy guarded — a rapid double-tap on ↻ must not fire two concurrent
  // sends for the same bubble (the retry button is also disabled while
  // status === "sending", but the state flip is racy across two fast events
  // so we re-check here too).
  async function onRetry(msg: LocalMessage) {
    if (msg.status === "sending") return;
    const tempId = msg.id;
    const previewUrl = msg.localPreviewUrl;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, status: "sending", error: undefined } : m
      )
    );
    try {
      // Image bubble: re-read the compressed bytes from the object URL and
      // re-upload. Text bubble: re-send the body.
      if (previewUrl) {
        const blob = await (await fetch(previewUrl)).blob();
        const fd = new FormData();
        fd.append("file", blob, "photo.jpg");
        const res = await sendImageMessage(thread.id, fd);
        if (res.ok) {
          setMessages((prev) =>
            prev.some((m) => m.id === res.message.id)
              ? prev.filter((m) => m.id !== tempId)
              : prev.map((m) =>
                  m.id === tempId
                    ? { ...res.message, localPreviewUrl: previewUrl }
                    : m
                )
          );
        } else {
          markFailed(
            tempId,
            res.error === "limit_reached"
              ? t("limitReached")
              : tErr(errorKey(res.error))
          );
        }
      } else {
        const res = await sendMessage(thread.id, { body: msg.body });
        reconcile(tempId, res);
      }
    } catch {
      markFailed(tempId, tErr("generic"));
    } finally {
      taRef.current?.focus();
    }
  }

  // Discard a failed message: drop the bubble entirely (the user chose to
  // discard, so the text goes with it).
  function onDiscard(tempId: string) {
    setMessages((prev) => {
      const gone = prev.find((m) => m.id === tempId);
      if (gone?.localPreviewUrl) URL.revokeObjectURL(gone.localPreviewUrl);
      return prev.filter((m) => m.id !== tempId);
    });
  }

  // Localized day-separator label: "Heute"/"Gestern" for the two most recent
  // local days (keys seeded at mount), otherwise a medium localized date.
  function formatDayLabel(iso: string): string {
    const key = localDayKey(iso);
    if (key === todayKey) return t("today");
    if (key === yesterdayKey) return t("yesterday");
    return format.dateTime(new Date(iso), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // Precompute per-message render flags: day separators (local date) and
  // grouping (same sender within 5 min → tight spacing, one timestamp).
  const rows = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const showDay = !prev || localDayKey(prev.createdAt) !== localDayKey(m.createdAt);
      const prevSameGroup =
        !!prev &&
        !showDay &&
        prev.senderId === m.senderId &&
        new Date(m.createdAt).getTime() -
          new Date(prev.createdAt).getTime() <
          GROUP_WINDOW_MS;
      const nextShowDay =
        !!next && localDayKey(next.createdAt) !== localDayKey(m.createdAt);
      const nextSameGroup =
        !!next &&
        !nextShowDay &&
        next.senderId === m.senderId &&
        new Date(next.createdAt).getTime() -
          new Date(m.createdAt).getTime() <
          GROUP_WINDOW_MS;
      // Timestamp only on the last message of a group.
      const isGroupEnd = !nextSameGroup;
      return { message: m, showDay, prevSameGroup, isGroupEnd };
    });
  }, [messages]);

  return (
    // Mobile: 100dvh (which now shrinks with the on-screen keyboard, see the
    // `viewport.interactiveWidget` export in [locale]/layout.tsx) minus the
    // chrome that sits in document flow above/below this component on the
    // (app) route group — the mobile AppNav bar (~60px) plus the shared
    // container's `pt-10 pb-24` (the pb-24 reserves room for the fixed
    // MobileTabBar + its safe-area inset). That total is ~12rem; changing
    // it requires updating src/app/[locale]/(app)/layout.tsx in lockstep.
    // Desktop: MessagesShell gives this component a real `h-full` inside its
    // own `lg:h-[calc(100vh-9rem)]` grid, so `lg:h-full` takes over there.
    <div className="flex h-[calc(100dvh-12rem)] flex-col lg:h-full">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col lg:px-6">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line py-4">
        <Link
          href="/messages"
          className="press -m-2 flex h-11 w-11 items-center justify-center text-mute hover:text-ink lg:hidden"
          aria-label={t("back")}
        >
          ←
        </Link>
        <Avatar name={thread.otherName} src={thread.otherAvatarUrl} size={38} />
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight text-ink">
            {thread.otherName}
          </p>
          {thread.shootTitle && (
            <p className="truncate text-[13px] text-mute">
              {t("about", { title: thread.shootTitle })}
            </p>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {thread.shootId && (
            <Link
              href={`/shoots/${thread.shootId}`}
              className="press hidden min-h-11 items-center border border-line px-4 text-[13px] text-ink transition-colors hover:border-ink sm:inline-flex"
            >
              {t("viewShoot")}
            </Link>
          )}
          <button
            type="button"
            data-testid="thread-block-toggle"
            onClick={onToggleBlock}
            disabled={blocking}
            className="press flex min-h-11 items-center border border-line px-3.5 text-[12px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {iBlocked ? t("unblock") : t("block")}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label={t("conversationLabel", { name: thread.otherName })}
          // This is the WCAG-recommended technique for making a scrollable region
          // keyboard operable (arrow/page keys scroll it) since role="log" isn't
          // in the rule's interactive-elements list.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="h-full space-y-0 overflow-y-auto overscroll-contain py-5 focus:outline-none"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState description={t("threadEmpty")} />
            </div>
          ) : (
            <>
              {hasMore && (
                <div className="mb-3 flex justify-center">
                  <button
                    type="button"
                    onClick={onLoadEarlier}
                    disabled={loadingEarlier}
                    className="press rounded-full border border-line px-3.5 py-1.5 text-[12px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                  >
                    {loadingEarlier ? t("loadingEarlier") : t("loadEarlier")}
                  </button>
                </div>
              )}
              {rows.map(({ message: m, showDay, prevSameGroup, isGroupEnd }) => {
              const mine = m.senderId === thread.meId;
              const failed = m.status === "failed";
              const isRead =
                mine &&
                !m.status &&
                otherLastReadAt != null &&
                m.createdAt <= otherLastReadAt;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-3 flex justify-center">
                      <span className="label text-mute-2">
                        {formatDayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`group flex flex-col ${
                      mine ? "items-end" : "items-start"
                    } ${prevSameGroup ? "mt-0.5" : "mt-3"}`}
                  >
                    {(() => {
                      const hasImage = !!(m.imagePath || m.localPreviewUrl);
                      const imgSrc = m.localPreviewUrl ?? m.imageUrl;
                      return (
                        <>
                          {hasImage && (
                            <div
                              className={`flex flex-col ${
                                mine ? "items-end" : "items-start"
                              } ${m.status === "sending" ? "opacity-70" : ""}`}
                            >
                              <button
                                type="button"
                                onClick={() => imgSrc && setLightboxSrc(imgSrc)}
                                disabled={!imgSrc}
                                aria-label={t("photoAlt")}
                                className="press relative block max-w-[78%] overflow-hidden rounded border border-line bg-chip"
                              >
                                <span className="sr-only">
                                  {mine ? t("you") : thread.otherName}:{" "}
                                </span>
                                {imgSrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={imgSrc}
                                    alt={t("photoAlt")}
                                    loading="lazy"
                                    decoding="async"
                                    className="block max-h-80 w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-40 w-40 items-center justify-center text-mute">
                                    <Spinner />
                                  </span>
                                )}
                                {m.status === "sending" && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-ink/20 text-paper">
                                    <Spinner />
                                  </span>
                                )}
                              </button>
                            </div>
                          )}
                          {m.body && (
                            <span
                              className={`${hasImage ? "mt-1 " : ""}max-w-[78%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] px-4 py-2.5 text-[14px] leading-relaxed ${
                                mine
                                  ? failed
                                    ? "bg-accent/60 text-paper"
                                    : "bg-accent text-paper"
                                  : "bg-chip text-ink"
                              } ${m.status === "sending" ? "opacity-70" : ""}`}
                            >
                              {!hasImage && (
                                <span className="sr-only">
                                  {mine ? t("you") : thread.otherName}:{" "}
                                </span>
                              )}
                              {m.body}
                            </span>
                          )}
                        </>
                      );
                    })()}

                    {failed ? (
                      <span
                        role="alert"
                        className="mt-1 flex items-center gap-2 px-1 text-[11px] text-accent"
                      >
                        <span>{m.error ?? t("sendFailed")}</span>
                        <button
                          type="button"
                          onClick={() => onRetry(m)}
                          disabled={m.status === "sending"}
                          aria-label={t("retry")}
                          className="press -m-1 flex h-11 w-11 items-center justify-center rounded-full hover:text-ink disabled:pointer-events-none disabled:opacity-50"
                        >
                          ↻
                        </button>
                        <button
                          type="button"
                          onClick={() => onDiscard(m.id)}
                          disabled={m.status === "sending"}
                          aria-label={t("discard")}
                          className="press -m-1 flex h-11 w-11 items-center justify-center rounded-full hover:text-ink disabled:pointer-events-none disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      isGroupEnd && (
                        <span className="mt-1 flex items-center gap-2 px-1 text-[11px] text-mute-2">
                          <span className="tabular tracking-[0.18em]">
                            {hhmm(m.createdAt)}
                          </span>
                          {mine && !m.status && (
                            <span aria-hidden>{isRead ? "✓✓" : "✓"}</span>
                          )}
                          {!mine && (
                            <span className="opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
                              <ReportButton
                                targetType="message"
                                targetId={m.id}
                                compact
                              />
                            </span>
                          )}
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
              })}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Floating "new messages" pill — only while scrolled up. */}
        {showPill && (
          <button
            type="button"
            onClick={() => {
              setHasNew(false);
              atBottomRef.current = true;
              setAtBottom(true);
              scrollToBottom(
                prefersReducedMotionRef.current ? "auto" : "smooth"
              );
            }}
            className="press absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-paper shadow-lg"
          >
            {t("newMessages")} ↓
          </button>
        )}
      </div>

      {/* Composer */}
      {composerDisabled ? (
        <div className="shrink-0 border-t border-line py-4 text-center text-[13px] text-mute">
          {iBlocked ? t("blockedNotice") : t("blockedByNotice")}
        </div>
      ) : (
        <div className="shrink-0 border-t border-line pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          {imageError && (
            <p role="alert" className="mb-2 px-1 text-[12px] text-accent">
              {imageError}
            </p>
          )}
          <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            data-testid="message-image-input"
            onChange={onPickImage}
            disabled={sending}
          />
          <button
            type="button"
            data-testid="message-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            aria-label={t("attachPhoto")}
            className="press flex h-11 w-11 shrink-0 items-center justify-center border border-line bg-surface text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
          <textarea
            ref={taRef}
            data-testid="message-input"
            value={body}
            aria-label={t("inputLabel")}
            maxLength={4000}
            enterKeyHint="send"
            onChange={(e) => {
              setBody(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => {
              // Guard IME composition: don't submit mid-composition.
              if (e.nativeEvent.isComposing) return;
              // Enter submits only on fine pointers (mouse/trackpad). On touch
              // Enter inserts a newline and the Send button submits instead.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                finePointerRef.current
              ) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder={t("placeholder")}
            className="max-h-32 flex-1 resize-none border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none lg:text-[14px]"
          />
          <button
            type="button"
            data-testid="message-send"
            onClick={onSend}
            disabled={!body.trim() || sending}
            aria-label={t("send")}
            className="press flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-paper transition-opacity disabled:opacity-40"
          >
            {sending ? (
              <Spinner />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20V5M6 11l6-6 6 6" />
              </svg>
            )}
          </button>
          </div>
        </div>
      )}
      </div>
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={t("photoAlt")}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
