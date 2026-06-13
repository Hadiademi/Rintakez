import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("landing");
  return (
    <main className="min-h-screen bg-paper text-ink p-8">
      <p className="label text-mute">Rintakez</p>
      <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
    </main>
  );
}
