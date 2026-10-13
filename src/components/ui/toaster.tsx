"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  browserMomentStorage,
  hasSeenMoment,
  markMomentSeen,
} from "@/lib/moment-once";
import {
  toastDuration,
  toastReducer,
  type Toast,
  type ToastAction,
  type ToastVariant,
} from "@/lib/toast-queue";

export type ToastOptions = {
  /** Defaults to "success" — most toasts confirm something that just worked. */
  variant?: ToastVariant;
  description?: string;
  action?: ToastAction;
};

type ToastContextValue = {
  /** Show a short toast. Identical messages are de-duplicated. */
  toast: (message: string, options?: ToastOptions) => void;
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

export function ToasterProvider({
  children,
  hasTabBar = true,
}: {
  children: ReactNode;
  /** Logged-in app pages have the fixed MobileTabBar to clear on phones. */
  hasTabBar?: boolean;
}) {
  const t = useTranslations("toast");
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    dispatch({
      type: "add",
      toast: {
        id: `t${++counter}`,
        message,
        variant: options.variant ?? "success",
        description: options.description,
        action: options.action,
      },
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "dismiss", id });
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Positioning layer. Fixed so it clears the flow; sits above the
          MobileTabBar on mobile (safe-area aware) and bottom-right on desktop.
          pointer-events-none lets clicks pass through the empty gaps. Each
          toast is its own live region: role="status" (polite) for
          confirmations, role="alert" (assertive) for errors. */}
      <div
        className={`pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end lg:px-0 ${
          hasTabBar
            ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]"
            : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
        }`}
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

/**
 * A toast for a milestone the user meets by opening a page (their first offer
 * arrived), shown once per device. Renders nothing.
 */
export function ShowToastOnce({
  id,
  message,
  options,
}: {
  id: string;
  message: string;
  options?: ToastOptions;
}) {
  const { toast } = useToast();
  useEffect(() => {
    const storage = browserMomentStorage();
    if (hasSeenMoment(storage, id)) return;
    markMomentSeen(storage, id);
    toast(message, options);
    // Keyed on the id alone — the message/options are built inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, toast]);
  return null;
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
  const duration = toastDuration(toast);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Time left on the auto-dismiss timer. The effect's cleanup subtracts what
  // elapsed, so hovering or focusing the toast pauses it (WCAG 2.2.1) and
  // leaving resumes from where it stopped instead of restarting.
  const remaining = useRef(duration);

  useEffect(() => {
    if (paused || leaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, leaving]);

  const isError = toast.variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      data-variant={toast.variant}
      data-leaving={leaving || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onDismiss(toast.id);
      }}
      className="toast pointer-events-auto relative w-full max-w-sm overflow-hidden bg-ink text-paper shadow-[0_16px_40px_-12px_rgb(0_0_0/0.45)] lg:w-[380px]"
    >
      <div className="flex items-start gap-3 py-3.5 pl-4 pr-1">
        <ToastIcon variant={toast.variant} />
        <div className="min-w-0 flex-1 pt-px">
          <p className="text-sm font-medium leading-5">{toast.message}</p>
          {toast.description && (
            <p className="mt-0.5 text-[13px] leading-5 text-paper/65">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <Link
              href={toast.action.href}
              onClick={() => setLeaving(true)}
              className="-mb-2.5 mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-paper underline decoration-paper/30 underline-offset-4 transition-colors hover:decoration-paper"
            >
              {toast.action.label}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label={dismissLabel}
          className="press -my-2 flex h-11 w-11 shrink-0 items-center justify-center text-paper/55 transition-colors hover:text-paper"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {/* Countdown hairline — decorative; pauses with the timer. */}
      <span
        aria-hidden="true"
        className="toast-timer absolute inset-x-0 bottom-0 h-[2px] origin-left"
        style={{
          animationDuration: `${duration}ms`,
          animationPlayState: paused || leaving ? "paused" : "running",
        }}
      />
    </div>
  );
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "error") {
    return (
      <span
        aria-hidden="true"
        className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] border-[#ef4444] text-[#ef4444]"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <path d="M12 5v9" />
          <path d="M12 19.5v.01" />
        </svg>
      </span>
    );
  }
  if (variant === "info") {
    return (
      <span
        aria-hidden="true"
        className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-paper/15 text-paper"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <path d="M12 10.5V19" />
          <path d="M12 4.5v.01" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="toast-check mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-white"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
      </svg>
    </span>
  );
}
