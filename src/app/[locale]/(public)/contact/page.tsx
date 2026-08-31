import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("title"),
    alternates: buildAlternates(locale, "/contact"),
  };
}

/**
 * Public contact surface. Before this page the only contact affordance on
 * the whole platform was the address inside the Impressum — a serious
 * marketplace needs a "how do I reach a human" answer one click away.
 */
export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <main className="bg-paper text-ink">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          {t("title")}
        </h1>
        <p className="mt-3 text-mute">{t("intro")}</p>

        <div className="mt-10 border border-line bg-surface p-6">
          <p className="label text-mute">{t("emailLabel")}</p>
          <a
            href="mailto:info@framly.ch"
            className="mt-1 inline-block text-xl font-medium text-ink underline underline-offset-4 hover:text-accent"
          >
            info@framly.ch
          </a>
          <p className="mt-4 text-[14px] text-mute">{t("responseNote")}</p>
        </div>

        <p className="mt-8 text-[13px] text-mute-2">
          <Link
            href="/impressum"
            className="underline underline-offset-2 hover:text-ink"
          >
            {t("legalNote")}
          </Link>
        </p>
      </div>
    </main>
  );
}
