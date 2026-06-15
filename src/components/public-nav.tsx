import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * Header shown to anonymous visitors browsing the public marketplace (open
 * shoots, photographer directory & profiles). Logged-in users get <AppNav>
 * instead — see the (app) layout.
 */
export async function PublicNav() {
  const t = await getTranslations("nav");
  const browseLinks = (
    <>
      <Link
        href="/shoots"
        className="whitespace-nowrap text-mute transition-colors hover:text-ink"
      >
        {t("browseShoots")}
      </Link>
      <Link
        href="/photographers"
        className="whitespace-nowrap text-mute transition-colors hover:text-ink"
      >
        {t("photographers")}
      </Link>
    </>
  );

  return (
    <header className="border-b border-line">
      <div className="mx-auto max-w-7xl px-5 py-3.5 sm:px-8">
        {/* Row 1: brand + browse (sm+ inline) + auth cluster */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="shrink-0 text-lg font-medium tracking-tight text-ink"
          >
            Rintakez
          </Link>
          <nav className="hidden items-center gap-5 text-sm sm:flex">
            {browseLinks}
          </nav>
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="whitespace-nowrap text-sm text-ink hover:underline"
            >
              {t("login")}
            </Link>
            <Link
              href="/register"
              className="press whitespace-nowrap bg-ink px-3 py-1.5 text-sm text-paper"
            >
              {t("register")}
            </Link>
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
        {/* Row 2 (mobile only): browse links */}
        <nav className="mt-3 flex items-center gap-5 text-sm sm:hidden">
          {browseLinks}
        </nav>
      </div>
    </header>
  );
}
