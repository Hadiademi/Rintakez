import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export async function AdminTopbar({ displayName }: { displayName: string }) {
  const t = await getTranslations("admin");

  return (
    <header className="flex items-center gap-4 border-b border-line px-5 py-3 sm:px-8">
      <span className="label text-mute-2">{t("badgeAdmin")}</span>
      <div className="ml-auto flex items-center gap-3">
        <LocaleSwitcher />
        <ThemeToggle />
        <Link
          href="/home"
          className="press flex min-h-11 items-center border border-line px-4 text-[13px] text-ink transition-colors hover:border-ink"
        >
          {t("toApp")} →
        </Link>
        <span className="hidden text-[13px] text-mute sm:inline">
          {displayName}
        </span>
      </div>
    </header>
  );
}
