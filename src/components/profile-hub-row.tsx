"use client";

import { useSyncExternalStore } from "react";

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
 * A tappable account-hub row that toggles one settings section like a dropdown.
 * The active section is mirrored to the URL hash (e.g. #account) — the same
 * store `ProfileTabs` reads — so tapping a row reveals its panel and rotates the
 * chevron; tapping the open row again clears the hash and collapses it.
 *
 * `icon` is a pure (server-rendered) SVG node passed down from the page.
 */
export function ProfileHubRow({
  targetId,
  label,
  icon,
}: {
  targetId: string;
  label: string;
  icon: React.ReactNode;
}) {
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const isOpen = hash === targetId;

  function toggle() {
    // replaceState (not push) so Back doesn't walk the sections; then notify the
    // store ourselves — replaceState doesn't fire hashchange.
    history.replaceState(
      null,
      "",
      isOpen ? location.pathname + location.search : `#${targetId}`
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isOpen}
      data-testid={`hub-row-${targetId}`}
      className="press flex min-h-14 w-full items-center gap-4 border-b border-line px-1 py-4 text-left text-ink"
    >
      <span className={isOpen ? "text-accent" : "text-ink"}>{icon}</span>
      <span className="flex-1 text-[15px] text-ink">{label}</span>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 transition-transform ${
          isOpen ? "rotate-90 text-accent" : "text-mute-2"
        }`}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}
