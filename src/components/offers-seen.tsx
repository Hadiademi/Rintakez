"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// "New since your last visit" for the offers on one shoot. The visit time is
// kept per device (localStorage), like the other once-only UI memories.

const key = (shootId: string) => `framly:offers-seen:${shootId}`;

function readSeen(shootId: string): number | null {
  try {
    const raw = window.localStorage.getItem(key(shootId));
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeSeen(shootId: string, at: number): void {
  try {
    window.localStorage.setItem(key(shootId), String(at));
  } catch {
    // ignore — without storage nothing is ever marked new
  }
}

// The value read on arrival, so React's dev double-mount (which re-runs the
// effect right away, after this visit's timestamp was written) reuses it
// instead of reading back "just now".
const arrival = new Map<string, { value: number; at: number }>();

const LastSeenContext = createContext<number | null>(null);

export function OffersSeenProvider({
  shootId,
  visitAt,
  children,
}: {
  shootId: string;
  /** Server render time (ISO) — compared with the database's created_at,
   *  so a skewed device clock can't mark the wrong offers. */
  visitAt: string;
  children: ReactNode;
}) {
  // null on the server and the first client render (no hydration mismatch);
  // the stored time arrives a frame later.
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    const prev = arrival.get(shootId);
    // First visit: nothing that's already here is "new" to them, but an offer
    // arriving while they look (live refresh) is — so the arrival time counts.
    const visit = Date.parse(visitAt);
    const value =
      prev && performance.now() - prev.at < 2000
        ? prev.value
        : (readSeen(shootId) ?? visit);
    arrival.set(shootId, { value, at: performance.now() });
    writeSeen(shootId, visit);
    const frame = requestAnimationFrame(() => setLastSeen(value));
    return () => cancelAnimationFrame(frame);
    // visitAt changes on every server refresh; only a new visit (shootId)
    // records a new time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shootId]);

  return (
    <LastSeenContext.Provider value={lastSeen}>{children}</LastSeenContext.Provider>
  );
}

/**
 * An offer created after the owner's previous visit (or, on the first visit,
 * one that arrived while the page was open).
 */
export function useIsNewOffer(createdAt: string | undefined): boolean {
  const lastSeen = useContext(LastSeenContext);
  if (lastSeen === null || !createdAt) return false;
  return Date.parse(createdAt) > lastSeen;
}
