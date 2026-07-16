import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const EMAIL = "info@framly.ch";
const PHONE_DISPLAY = "079 338 75 33";
const PHONE_TEL = "+41793387533";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("impressumTitle") };
}

export default async function ImpressumPage() {
  const t = await getTranslations("legal");

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          {t("impressumTitle")}
        </h1>
        <p className="mt-3 text-mute">{t("impressumIntro")}</p>

        <section className="mt-10 space-y-3">
          <h2 className="label text-mute">{t("impressumOperator")}</h2>
          <div className="rounded border border-line bg-surface px-4 py-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
              {t("impressumOperatorBody")}
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="label text-mute">{t("impressumContact")}</h2>
          <div className="space-y-1.5 rounded border border-line bg-surface px-4 py-4 text-sm text-ink">
            <p>
              <a href={`mailto:${EMAIL}`} className="transition-colors hover:text-accent">
                {EMAIL}
              </a>
            </p>
            <p>
              <a href={`tel:${PHONE_TEL}`} className="transition-colors hover:text-accent">
                {PHONE_DISPLAY}
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
