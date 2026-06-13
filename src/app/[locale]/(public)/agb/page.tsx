import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("agbTitle") };
}

const SECTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export default async function AgbPage() {
  const t = await getTranslations("legal");

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          {t("agbTitle")}
        </h1>
        <p className="mt-3 text-mute">{t("agbIntro")}</p>
        <p className="mt-1 text-[13px] text-mute-2">{t("agbReviewNote")}</p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((n) => (
            <section key={n} className="space-y-2">
              <h2 className="text-lg font-medium tracking-tight text-ink">
                {t(`agbS${n}T`)}
              </h2>
              <p className="leading-relaxed text-mute">{t(`agbS${n}B`)}</p>
            </section>
          ))}
        </div>

        <p className="mt-12 text-[13px] text-mute-2">{t("agbUpdated")}</p>
      </div>
    </main>
  );
}
