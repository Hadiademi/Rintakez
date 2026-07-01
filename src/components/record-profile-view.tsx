"use client";

import { useEffect } from "react";
import { recordProfileView } from "@/lib/actions/analytics";

/**
 * Fires the profile-view server action once on mount. Renders nothing, so it
 * never affects layout/paint — the server action call happens after the page
 * has already rendered and hydrated, and any failure is swallowed (see
 * recordProfileView), so a slow or failing analytics write can never delay or
 * break the profile page for the visitor.
 */
export function RecordProfileView({ photographerId }: { photographerId: string }) {
  useEffect(() => {
    void recordProfileView(photographerId);
    // Only ever re-fires if the viewed profile changes (e.g. client-side nav
    // between two photographer profiles).
  }, [photographerId]);

  return null;
}
