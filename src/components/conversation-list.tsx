"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { formatMessageTime } from "@/lib/format";
import type { ConversationSummary } from "@/lib/actions/messages";

/** Inbox conversation list: avatar, name, last-message preview, time, unread —
 *  with the active conversation highlighted (used in the desktop sidebar and as
 *  the full mobile list). */
export function ConversationList({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  const t = useTranslations("messages");
  const pathname = usePathname();
  return (
    <ul className="divide-y divide-line">
      {conversations.map((c) => {
        const active = pathname === `/messages/${c.id}`;
        const preview = c.lastIsPhoto
          ? t("photoPreview")
          : c.lastBody ?? c.shootTitle ?? "";
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              data-testid="conversation-row"
              className={`flex items-center gap-3 px-4 py-4 transition-colors ${
                active ? "bg-surface" : "hover:bg-surface"
              }`}
            >
              <Avatar name={c.otherName} src={c.otherAvatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={`truncate text-[15px] ${
                      c.unread ? "font-semibold text-ink" : "text-ink"
                    }`}
                  >
                    {c.otherName}
                  </p>
                  <span className="tabular shrink-0 text-[12px] text-mute-2">
                    {formatMessageTime(c.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      c.unread ? "text-ink" : "text-mute"
                    }`}
                  >
                    {c.lastMine && preview ? "↩ " : ""}
                    {preview}
                  </p>
                  {c.unread && (
                    <span
                      data-testid="conversation-unread-dot"
                      className="h-2 w-2 shrink-0 rounded-full bg-accent"
                    />
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
