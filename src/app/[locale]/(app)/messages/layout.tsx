import { getTranslations } from "next-intl/server";
import { getConversations } from "@/lib/actions/messages";
import { ConversationList } from "@/components/conversation-list";
import { MessagesShell } from "@/components/messages-shell";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, t] = await Promise.all([
    getConversations(),
    getTranslations("messages"),
  ]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-3 pt-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {conversations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5z" />
                </svg>
              }
              description={t("empty")}
            />
          </div>
        ) : (
          <ConversationList conversations={conversations} />
        )}
      </div>
    </div>
  );

  return <MessagesShell sidebar={sidebar}>{children}</MessagesShell>;
}
