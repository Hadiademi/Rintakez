import { useTranslations } from "next-intl";

/**
 * Keyboard-only "skip to main content" link. Visually hidden until it
 * receives focus (the first Tab stop on the page), then jumps straight past
 * the repeated nav chrome to the `id="main"` landmark.
 *
 * No "use client" here: `useTranslations` resolves to next-intl's
 * React-Server-Components translator when this renders on the server (as it
 * does in the (app) and root layouts), and to the normal client hook if ever
 * rendered inside a client boundary — so this component works unmodified in
 * both.
 */
export function SkipToContent() {
  const t = useTranslations("common");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-paper focus:outline-none focus:ring-2 focus:ring-paper"
    >
      {t("skipToContent")}
    </a>
  );
}
