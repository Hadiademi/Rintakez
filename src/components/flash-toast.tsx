"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toaster";
import { removeQueryParam } from "@/components/ui/moment";
import { isFlashKey } from "@/lib/flash";

/**
 * Shows a ?flash=<key> confirmation once on arrival and drops the flag from
 * the URL. Mounted in the app layout, so it runs whenever a redirect lands
 * the user in the app (email link, password reset).
 */
export function FlashToast() {
  const t = useTranslations("toast");
  const { toast } = useToast();
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("flash");
    if (key === null) return;
    removeQueryParam("flash");
    if (isFlashKey(key)) toast(t(key));
    // Arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
