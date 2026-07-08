import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

/**
 * Desktop right-pane placeholder when no conversation is selected. On mobile the
 * shell hides this and shows the conversation list instead (see MessagesShell).
 */
export default async function MessagesIndexPage() {
  const t = await getTranslations("messages");
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-3 p-10 text-center lg:flex">
      <div className="text-mute-2" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
        </svg>
      </div>
      <p className="text-sm text-mute">{t("selectConversation")}</p>
    </div>
  );
}
