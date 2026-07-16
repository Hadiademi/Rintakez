import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("legal");

  return (
    <footer
      data-testid="site-footer"
      className="mt-auto border-t border-line py-8"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 sm:flex-row sm:justify-between">
        <span className="label text-mute">© 2026 Framly</span>
        <nav className="flex items-center gap-5">
          <Link
            href="/impressum"
            className="label text-mute hover:text-ink transition-colors"
          >
            {t("footerImpressum")}
          </Link>
          <Link
            href="/datenschutz"
            className="label text-mute hover:text-ink transition-colors"
          >
            {t("footerDatenschutz")}
          </Link>
          <Link
            href="/agb"
            className="label text-mute hover:text-ink transition-colors"
          >
            {t("footerAgb")}
          </Link>
          {/* Official brand account. External, so a plain anchor (not the
              locale-aware Link) with the usual new-tab safety rel. Icon-only,
              so the label lives in aria-label. The -m/p pair grows the tap
              target without shifting the row. */}
          <a
            href="https://www.instagram.com/framly.ch"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("footerInstagram")}
            className="-m-1.5 inline-flex items-center p-1.5 text-mute transition-colors hover:text-ink"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}
