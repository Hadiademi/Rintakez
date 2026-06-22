import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("datenschutzTitle") };
}

export default async function DatenschutzPage() {
  const t = await getTranslations("legal");

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-2xl px-6 py-16 space-y-10">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-ink">
            {t("datenschutzTitle")}
          </h1>
          <p className="mt-3 text-mute">{t("dsIntro")}</p>
        </div>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsDataTitle")}</h2>
          <p className="text-sm text-mute leading-relaxed">{t("dsData")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsPurposeTitle")}</h2>
          <p className="text-sm text-mute leading-relaxed">{t("dsPurpose")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsProcessorTitle")}</h2>
          <p className="text-sm text-mute leading-relaxed">
            {t("dsProcessor")}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsSubprocessorsTitle")}</h2>
          <p className="text-sm text-mute leading-relaxed">
            {t("dsSubprocessors")}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsRetentionTitle")}</h2>
          <p className="text-sm text-mute leading-relaxed">{t("dsRetention")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsCookiesTitle")}</h2>
          <p className="text-sm text-mute leading-relaxed">{t("dsCookies")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsRightsTitle")}</h2>
          <p className="text-sm text-mute leading-relaxed">{t("dsRights")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("dsContactTitle")}</h2>
          {/* DPO / privacy contact placeholder — MUST be filled before public launch */}
          <div className="rounded border border-line bg-surface px-4 py-4">
            <p className="text-sm font-medium text-ink">
              {t("dsContactPlaceholder")}
            </p>
          </div>
        </section>

        <p className="text-xs text-mute pt-4 border-t border-line">
          {t("dsUpdated")}
        </p>
      </div>
    </main>
  );
}
