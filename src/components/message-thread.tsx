"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient as createRealtimeClient } from "@supabase/supabase-js";
import { Link } from "@/i18n/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  sendMessage,
  markConversationRead,
  type ThreadData,
  type ThreadMessage,
} from "@/lib/actions/messages";

export function MessageThread({ thread }: { thread: ThreadData }) {
  const t = useTranslations("messages");
  const [messages, setMessages] = useState<ThreadMessage[]>(thread.messages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      channel.subscribe();
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
    setBody("");
    const res = await sendMessage(thread.id, { body: text });
    if (!res.ok) setBody(text); // restore on failure
    setSending(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-2xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <Link href="/messages" className="press text-mute hover:text-ink">
          ←
        </Link>
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
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto py-5">
        {messages.length === 0 ? (
          <p className="text-mute">{t("threadEmpty")}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === thread.meId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
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
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-line pt-4">
        <textarea
          data-testid="message-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
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
        <button
          type="button"
          data-testid="message-send"
          onClick={onSend}
          disabled={sending || !body.trim()}
          className="press shrink-0 bg-ink px-5 py-3 text-[14px] font-medium text-paper disabled:opacity-40"
        >
          {t("send")}
        </button>
      </div>
    </div>
  );
}
