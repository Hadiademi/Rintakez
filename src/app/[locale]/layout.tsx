import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ThemeScript } from "@/components/theme-script";
import { SwRegister } from "@/components/sw-register";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { Analytics } from "@/components/analytics";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import "../globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// `viewportFit: "cover"` lets the installed PWA draw under the safe areas so
// `env(safe-area-inset-*)` actually resolves (otherwise it's inert and the
// composer's safe-area padding below the home indicator does nothing).
// `interactiveWidget: "resizes-content"` makes `100dvh` shrink when the
// on-screen keyboard opens instead of leaving content hidden behind it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

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
    title: { default: t("title"), template: "%s — Framly" },
    description: t("description"),
    // iOS ignores the web manifest for home-screen install: it needs an
    // apple-touch-icon and the apple-mobile-web-app meta tags to run standalone.
    icons: { apple: [{ url: "/icon-192.png" }] },
    appleWebApp: { capable: true, title: "Framly", statusBarStyle: "default" },
    // No path-aware `alternates` here: this layout applies to every route,
    // and next-intl's `getPathname` needs to know the *current* path per
    // locale (not just the locale) to build correct hreflang. A static
    // "/de" / "/fr" / "/en" map would make every page advertise the locale
    // homepages as its alternates, which is actively harmful for SEO. Pages
    // set their own path-aware `alternates` via `buildAlternates()`
    // (see src/lib/seo.ts); this default is intentionally omitted so a page
    // that forgets to set it doesn't silently inherit a wrong one.
    openGraph: {
      title: t("ogTitle"),
      description: t("description"),
      type: "website",
      locale,
      siteName: "Framly",
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
        <NextIntlClientProvider>
          {children}
          <PwaInstallPrompt />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
