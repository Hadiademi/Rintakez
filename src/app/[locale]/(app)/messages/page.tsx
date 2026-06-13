import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getConversations } from "@/lib/actions/messages";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const conversations = await getConversations();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">
        {t("title")}
      </h1>

      {conversations.length === 0 ? (
        <p className="text-mute">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                data-testid="conversation-row"
                className="press flex items-center justify-between gap-4 py-5"
              >
                <div className="flex items-center gap-3">
                  {c.unread && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`truncate text-[15px] ${c.unread ? "font-semibold text-ink" : "text-ink"}`}
                    >
                      {c.otherName}
                    </p>
                    {c.shootTitle && (
                      <p className="truncate text-[13px] text-mute">
                        {t("about", { title: c.shootTitle })}
                      </p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-mute">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
