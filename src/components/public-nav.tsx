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
      <Link
        href="/pricing"
        className="whitespace-nowrap text-mute transition-colors hover:text-ink"
      >
        {t("pricing")}
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
            className="shrink-0 text-base font-medium tracking-tight text-ink sm:text-lg"
          >
            Rintakez
          </Link>
          <nav className="hidden items-center gap-5 text-sm sm:flex">
            {browseLinks}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
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
            {/* Theme toggle is a nicety — drop it on the tight anon mobile bar
                (system colour-scheme still applies); keep locale (CH trilingual). */}
            <span className="hidden sm:inline-flex">
              <ThemeToggle />
            </span>
            <LocaleSwitcher />
          </div>
        </div>
        {/* Row 2 (mobile only): browse links. flex-wrap guards against
            overflow when locale labels (e.g. German) are wide at narrow
            widths, so the row never forces page-level horizontal scroll. */}
        <nav className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:hidden">
          {browseLinks}
        </nav>
      </div>
    </header>
  );
}
