"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const t = useTranslations("theme");
  // Initial value "light" matches the server-rendered data-theme="light".
  // After mount we sync with the actual DOM value (ThemeScript may have changed it to dark).
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Reading DOM state set by ThemeScript (pre-paint) to sync initial React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light"
    );
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggle")}
      data-testid="theme-toggle"
      className="press text-mute hover:text-ink"
    >
      {/* sun when dark (click → light), moon when light (click → dark) */}
      {theme === "dark" ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
