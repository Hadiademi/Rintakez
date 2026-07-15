"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { formatMessageTime } from "@/lib/format";
import type { ConversationSummary } from "@/lib/actions/messages";

type Filter = "all" | "unread";

/** Inbox conversation list: filter tabs (All / Unread) plus rows of avatar,
 *  name, last-message preview, time and an unread marker — with the active
 *  conversation flagged by a left accent bar. Used in the desktop sidebar and
 *  as the full mobile list. */
export function ConversationList({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  const t = useTranslations("messages");
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>("all");

  const unreadCount = useMemo(
    () => conversations.filter((c) => c.unread).length,
    [conversations]
  );

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filterAll"), count: conversations.length },
    { key: "unread", label: t("filterUnread"), count: unreadCount },
  ];

  const shown =
    filter === "unread" ? conversations.filter((c) => c.unread) : conversations;

  return (
    <div>
      {/* Filter tabs — active tab underlined, count set in tabular figures. */}
      <div className="flex items-center gap-6 border-b border-line px-4">
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              aria-pressed={active}
              className={`-mb-px flex items-center gap-1.5 border-b-2 py-3 text-sm transition-colors ${
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-mute hover:text-ink"
              }`}
            >
              {tab.label}
              <span className="tabular text-[12px] text-mute-2">
                {String(tab.count).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-mute">
          {t("noUnread")}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((c) => {
            const active = pathname === `/messages/${c.id}`;
            const preview = c.lastIsPhoto
              ? t("photoPreview")
              : c.lastBody ?? c.shootTitle ?? "";
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  data-testid="conversation-row"
                  className={`flex items-center gap-3 border-l-2 px-4 py-4 transition-colors ${
                    active
                      ? "border-ink bg-surface"
                      : "border-transparent hover:bg-surface"
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
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 bg-accent"
                        />
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
