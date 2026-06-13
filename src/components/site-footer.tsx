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
        <span className="label text-mute">© 2026 Rintakez</span>
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
        </nav>
      </div>
    </footer>
  );
}
