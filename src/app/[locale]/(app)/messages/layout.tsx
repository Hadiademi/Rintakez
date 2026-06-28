import { getTranslations } from "next-intl/server";
import { getConversations } from "@/lib/actions/messages";
import { ConversationList } from "@/components/conversation-list";
import { MessagesShell } from "@/components/messages-shell";

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
      <div className="shrink-0 border-b border-line px-4 py-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-mute">{t("empty")}</p>
        ) : (
          <ConversationList conversations={conversations} />
        )}
      </div>
    </div>
  );

  return <MessagesShell sidebar={sidebar}>{children}</MessagesShell>;
}
