"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { toastReducer, type Toast } from "@/lib/toast-queue";

/** How long a toast stays on screen before it auto-dismisses. */
const AUTO_DISMISS_MS = 3000;

type ToastContextValue = {
  /** Show a short confirmation toast. Identical messages are de-duplicated. */
  toast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToasterProvider>");
  }
  return ctx;
}

// Module-level counter keeps toast ids unique across the app without pulling in
// a uuid dependency; the value only needs to be unique among live toasts.
let counter = 0;

export function ToasterProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("toast");
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const toast = useCallback((message: string) => {
    dispatch({ type: "add", toast: { id: `t${++counter}`, message } });
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "dismiss", id });
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Positioning layer. Fixed so it clears the flow; sits above the
          MobileTabBar on mobile (safe-area aware) and bottom-right on desktop.
          pointer-events-none lets clicks pass through the empty gaps. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end lg:px-0"
      >
        {toasts.map((item) => (
          <ToastItem
            key={item.id}
            toast={item}
            dismissLabel={t("dismiss")}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  dismissLabel,
  onDismiss,
}: {
  toast: Toast;
  dismissLabel: string;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md bg-ink px-4 py-3 text-sm text-paper shadow-lg motion-safe:animate-[toast-in_160ms_ease-out] lg:w-auto"
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={dismissLabel}
        className="press -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-paper/70 hover:text-paper"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
