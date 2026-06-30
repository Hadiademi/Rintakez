"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient as createRealtimeClient } from "@supabase/supabase-js";
import { Link } from "@/i18n/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSwissDate } from "@/lib/format";
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

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function MessageThread({ thread }: { thread: ThreadData }) {
  const t = useTranslations("messages");
  const tErr = useTranslations("errors");
  const [messages, setMessages] = useState<ThreadMessage[]>(thread.messages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [iBlocked, setIBlocked] = useState(thread.iBlocked);
  const [blocking, setBlocking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Merge any messages we don't already have (by id), preserving order.
  function mergeMessages(incoming: ThreadMessage[]) {
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !ids.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }

  // The other side blocked me, or I blocked them → no new messages either way.
  const composerDisabled = iBlocked || thread.blockedByThem;

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
        setMessages((prev) =>
          prev.some((x) => x.id === m.id)
            ? prev
            : [
                ...prev,
                {
                  id: m.id,
                  senderId: m.sender_id,
                  body: m.body,
                  createdAt: m.created_at,
                },
              ]
        );
        if (m.sender_id !== thread.meId) markConversationRead(thread.id);
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
  }, [thread.id, thread.meId]);

  // Keep scrolled to the latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSend() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    setBody("");
    if (taRef.current) taRef.current.style.height = "auto";
    const res = await sendMessage(thread.id, { body: text });
    if (res.ok) {
      // Render immediately; realtime echo (if any) dedupes by id.
      mergeMessages([res.message]);
    } else {
      setBody(text); // restore on failure so the user doesn't lose their text
      setSendError(tErr(errorKey(res.error)));
    }
    setSending(false);
  }

  return (
    <div className="flex h-[calc(100dvh-12rem)] flex-col lg:h-full">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col lg:px-6">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line py-4">
        <Link
          href="/messages"
          className="press text-mute hover:text-ink lg:hidden"
          aria-label="Back"
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
          className="press ml-auto shrink-0 rounded-full border border-line px-3 py-1 text-[12px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
        >
          {iBlocked ? t("unblock") : t("block")}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto py-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState description={t("threadEmpty")} />
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === thread.meId;
            const showDate =
              i === 0 ||
              messages[i - 1].createdAt.slice(0, 10) !==
                m.createdAt.slice(0, 10);
            return (
              <div key={m.id}>
                {showDate && (
                  <div className="my-3 flex justify-center">
                    <span className="label text-mute-2">
                      {formatSwissDate(m.createdAt.slice(0, 10))}
                    </span>
                  </div>
                )}
                <div
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <span
                    className={`max-w-[78%] whitespace-pre-wrap px-4 py-2.5 text-[14px] leading-relaxed ${
                      mine
                        ? "bg-ink text-paper"
                        : "border border-line bg-surface text-ink"
                    }`}
                  >
                    {m.body}
                  </span>
                  <span className="mt-1 px-1 text-[11px] text-mute-2">
                    {hhmm(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {composerDisabled ? (
        <div className="shrink-0 border-t border-line py-4 text-center text-[13px] text-mute">
          {iBlocked ? t("blockedNotice") : t("blockedByNotice")}
        </div>
      ) : (
        <div className="shrink-0 border-t border-line pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          {sendError && (
            <p
              data-testid="message-error"
              role="alert"
              className="mb-2 text-[13px] text-accent"
            >
              {sendError}
            </p>
          )}
          <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            data-testid="message-input"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder={t("placeholder")}
            className="max-h-32 flex-1 resize-none border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
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
