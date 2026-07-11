"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

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
  hideBarOnMobile = false,
}: {
  tabs: Tab[];
  children: React.ReactNode;
  /**
   * When true, the mobile section picker is hidden entirely (the desktop rail
   * is unaffected). Used by the mobile "account hub", which replaces the tab
   * bar with its own menu list; the panels still render and stay reachable via
   * the hash links the hub emits. Backward-compatible: defaults to false.
   */
  hideBarOnMobile?: boolean;
}) {
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

  const activeLabel = tabs.find((t) => t.id === active)?.label ?? "";

  return (
    <div className="mt-10 lg:grid lg:grid-cols-[180px_1fr] lg:gap-12">
      {/* Mobile: a native section picker. A horizontal tab row overflows and
          gets clipped mid-label with this many settings sections on a narrow
          screen, so every section stays reachable via a dropdown instead.
          Desktop keeps the sticky vertical rail below. */}
      <div
        className={
          hideBarOnMobile ? "hidden" : "relative mb-6 lg:hidden"
        }
      >
        <label htmlFor="profile-section" className="sr-only">
          {activeLabel}
        </label>
        <select
          id="profile-section"
          data-testid="profile-section-select"
          value={active}
          onChange={(e) => select(e.target.value)}
          className="w-full appearance-none border border-line bg-surface px-3.5 py-3 pr-10 text-sm font-medium text-ink focus:border-ink focus:outline-none"
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-mute"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      <nav
        aria-label="Profile sections"
        className="hidden lg:sticky lg:top-8 lg:block lg:self-start"
      >
        <ul role="tablist" className="flex flex-col gap-y-0.5">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`profile-tab-${t.id}`}
                  onClick={() => select(t.id)}
                  className={`relative w-full px-2 py-2.5 text-left text-sm transition-colors ${
                    isActive ? "font-medium text-ink" : "text-mute hover:text-ink"
                  }`}
                >
                  {t.label}
                  {isActive && (
                    <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 bg-ink" />
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
