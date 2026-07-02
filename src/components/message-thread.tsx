"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { createClient as createRealtimeClient } from "@supabase/supabase-js";
import { Link } from "@/i18n/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportButton } from "@/components/report-button";
import {
  sendMessage,
  markConversationRead,
  getThread,
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
};

/** Group boundary: same sender within this window renders as one visual block. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** How close to the bottom (px) still counts as "following along". */
const NEAR_BOTTOM_PX = 120;

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

  // "Today"/"yesterday" local-day keys, seeded once at mount (a chat session
  // won't outlive a midnight rollover in practice). Lazy initializers are the
  // sanctioned place for the otherwise-impure `Date` reads.
  const [{ todayKey, yesterdayKey }] = useState(() => ({
    todayKey: localDayKey(new Date().toISOString()),
    yesterdayKey: localDayKey(new Date(Date.now() - 86_400_000).toISOString()),
  }));

  // Derived from the initial load. Realtime updates to the other side's read
  // marker aren't subscribed (only message INSERTs are), so a ✓ flips to ✓✓ on
  // the next open of the thread — acceptable per the CH2 spec.
  const otherLastReadAt = thread.otherLastReadAt;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
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

  // The other side blocked me, or I blocked them → no new messages either way.
  const composerDisabled = iBlocked || thread.blockedByThem;

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

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
    const rt = createRealtimeClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: `sb-rt-thread-${thread.id}`,
        },
      }
    );
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
        };
        setMessages((prev) => {
          // Already have the server row (e.g. reconciled from onSend) → skip.
          if (prev.some((x) => x.id === m.id)) return prev;
          // My own echo may beat sendMessage's response back: reconcile the
          // oldest still-sending temp bubble with the same body instead of
          // appending a duplicate.
          if (m.sender_id === thread.meId) {
            const tempIdx = prev.findIndex(
              (x) => x.status === "sending" && x.body === m.body
            );
            if (tempIdx !== -1) {
              const next = prev.slice();
              next[tempIdx] = {
                id: m.id,
                senderId: m.sender_id,
                body: m.body,
                createdAt: m.created_at,
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
            },
          ];
        });
        if (m.sender_id !== thread.meId) {
          markConversationRead(thread.id);
          // Their message landed while we were scrolled up → surface the pill.
          // (Our own messages always auto-scroll, so never raise it for those.)
          if (!atBottomRef.current) setHasNew(true);
        }
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
      rt.removeChannel(channel);
      rt.realtime.disconnect();
    };
  }, [thread.id, thread.meId, mergeMessages]);

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

  // Retry a failed message: flip it back to sending and re-run the round-trip.
  // Re-entrancy guarded — a rapid double-tap on ↻ must not fire two concurrent
  // sends for the same bubble (the retry button is also disabled while
  // status === "sending", but the state flip is racy across two fast events
  // so we re-check here too).
  async function onRetry(msg: LocalMessage) {
    if (msg.status === "sending") return;
    const tempId = msg.id;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, status: "sending", error: undefined } : m
      )
    );
    try {
      const res = await sendMessage(thread.id, { body: msg.body });
      reconcile(tempId, res);
    } catch {
      markFailed(tempId, tErr("generic"));
    } finally {
      taRef.current?.focus();
    }
  }

  // Discard a failed message: drop the bubble entirely (the user chose to
  // discard, so the text goes with it).
  function onDiscard(tempId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
            <Link
              href={`/shoots/${thread.shootId}`}
              className="truncate text-[13px] text-mute hover:text-ink"
            >
              {t("about", { title: thread.shootTitle })}
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleBlock}
          disabled={blocking}
          className="press ml-auto flex min-h-11 shrink-0 items-center rounded-full border border-line px-3.5 text-[12px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
        >
          {iBlocked ? t("unblock") : t("block")}
        </button>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label={t("conversationLabel", { name: thread.otherName })}
          tabIndex={0}
          className="h-full space-y-0 overflow-y-auto overscroll-contain py-5 focus:outline-none"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState description={t("threadEmpty")} />
            </div>
          ) : (
            rows.map(({ message: m, showDay, prevSameGroup, isGroupEnd }) => {
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
                    <span
                      className={`max-w-[78%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] px-4 py-2.5 text-[14px] leading-relaxed ${
                        mine
                          ? failed
                            ? "border border-accent/40 bg-ink/70 text-paper"
                            : "bg-ink text-paper"
                          : "border border-line bg-surface text-ink"
                      } ${m.status === "sending" ? "opacity-70" : ""}`}
                    >
                      <span className="sr-only">
                        {mine ? t("you") : thread.otherName}:{" "}
                      </span>
                      {m.body}
                    </span>

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
                          <span>{hhmm(m.createdAt)}</span>
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
            })
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
          <div className="flex items-end gap-2">
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
          <Button
            type="button"
            data-testid="message-send"
            onClick={onSend}
            pending={sending}
            disabled={!body.trim()}
            size="lg"
            className="shrink-0"
          >
            {t("send")}
          </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
