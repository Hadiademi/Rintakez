import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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
          {/* Operator placeholder — MUST be filled before public launch */}
          <div className="rounded border border-line bg-surface px-4 py-4">
            <p className="text-sm font-medium text-ink">
              {t("impressumPlaceholder")}
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="label text-mute">{t("impressumContact")}</h2>
          {/* Contact placeholder — same as operator block above */}
          <div className="rounded border border-line bg-surface px-4 py-4">
            <p className="text-sm font-medium text-ink">
              {t("impressumPlaceholder")}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
