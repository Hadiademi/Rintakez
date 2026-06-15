import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ThemeScript } from "@/components/theme-script";
import { SwRegister } from "@/components/sw-register";
import { Analytics } from "@/components/analytics";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { DemoReset } from "@/components/demo-reset";
import "../globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: "%s — Rintakez" },
    description: t("description"),
    alternates: {
      languages: { de: "/de", fr: "/fr", en: "/en" },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("description"),
      type: "website",
      locale,
      siteName: "Rintakez",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} data-theme="light" className={interTight.variable} suppressHydrationWarning>
      <body>
        <ThemeScript />
        <SwRegister />
        <Analytics />
        <ClientErrorReporter />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <DemoReset />
      </body>
    </html>
  );
}
