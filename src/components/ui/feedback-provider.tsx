"use client";

import type { ReactNode } from "react";
import { ToasterProvider } from "@/components/ui/toaster";
import { ConfirmProvider } from "@/components/ui/confirm";
import { MomentProvider } from "@/components/ui/moment";

/**
 * Everything the app uses to answer the user: toasts (small confirmations),
 * confirm dialogs (instead of window.confirm) and moments (rare celebrations).
 * Mounted once per layout so all three survive client-side navigation.
 */
export function FeedbackProvider({
  children,
  hasTabBar = true,
}: {
  children: ReactNode;
  hasTabBar?: boolean;
}) {
  return (
    <ToasterProvider hasTabBar={hasTabBar}>
      <ConfirmProvider>
        <MomentProvider>{children}</MomentProvider>
      </ConfirmProvider>
    </ToasterProvider>
  );
}
