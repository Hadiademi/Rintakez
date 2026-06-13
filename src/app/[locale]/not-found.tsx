import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "states" });
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-paper text-ink px-6 text-center">
      <p className="label text-mute-2">404</p>
      <h1 className="text-xl font-medium">{t("notFoundTitle")}</h1>
      <Link href="/" className="press bg-ink text-paper px-5 py-2.5">
        {t("notFoundHome")}
      </Link>
    </main>
  );
}
