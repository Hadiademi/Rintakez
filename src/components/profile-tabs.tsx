"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

type Tab = { id: string; label: string };

const ActiveTabContext = createContext<string>("");

// Read the active tab from the URL hash via an external store (no
// set-state-in-effect). getServerSnapshot returns "" so SSR + first client
// render agree, then the hash takes over after hydration.
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
function getHash() {
  return window.location.hash.replace("#", "");
}
function getServerHash() {
  return "";
}

/**
 * Tabbed settings: only the selected section is shown instead of one long
 * stacked page. On desktop the tabs are a sticky left rail; on mobile they are a
 * horizontal, scrollable row above the panel. The active tab is mirrored to the
 * URL hash (e.g. /profile#security) so refresh + deep links keep their place and
 * the existing in-page links keep working.
 *
 * Panels render server data eagerly (hidden when inactive) so switching is
 * instant.
 */
export function ProfileTabs({
  tabs,
  children,
}: {
  tabs: Tab[];
  children: React.ReactNode;
}) {
  const tAria = useTranslations("profile");
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const active = tabs.some((t) => t.id === hash) ? hash : tabs[0]?.id ?? "";

  function select(id: string) {
    if (getHash() === id) return;
    // replaceState (not push) so Back doesn't walk through the tabs, then
    // notify the store ourselves — replaceState doesn't fire hashchange, and
    // this avoids the scroll-jump that setting location.hash would cause.
    history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  return (
    <div className="mt-10 lg:grid lg:grid-cols-[180px_1fr] lg:gap-12">
      <nav
        aria-label={tAria("profileSectionsAria")}
        className="mb-6 lg:sticky lg:top-8 lg:mb-0 lg:self-start"
      >
        <ul
          role="tablist"
          className="-mb-px flex gap-x-1 overflow-x-auto border-b border-line lg:flex-col lg:gap-y-0.5 lg:border-b-0"
        >
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`profile-tab-${t.id}`}
                  onClick={() => select(t.id)}
                  className={`relative whitespace-nowrap px-3 py-2.5 text-sm transition-colors lg:w-full lg:px-2 lg:text-left ${
                    isActive ? "font-medium text-ink" : "text-mute hover:text-ink"
                  }`}
                >
                  {t.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 bg-ink lg:inset-x-0 lg:bottom-1.5 lg:left-0 lg:top-1.5 lg:h-auto lg:w-0.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        <ActiveTabContext.Provider value={active}>
          {children}
        </ActiveTabContext.Provider>
      </div>
    </div>
  );
}

/** One settings section. Visible only when its `id` matches the active tab. */
export function ProfileTabPanel({
  id,
  label,
  children,
}: {
  id: string;
  label?: string;
  children: React.ReactNode;
}) {
  const active = useContext(ActiveTabContext);
  return (
    <div role="tabpanel" aria-label={label} hidden={active !== id}>
      {children}
    </div>
  );
}
