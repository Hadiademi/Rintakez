"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AriaRole,
  type ReactNode,
} from "react";

/**
 * Modal surface shared by moments and confirmations: a bottom sheet on phones,
 * a centred card from `sm` up. Built on the native <dialog> + showModal(), so
 * focus is trapped, the page behind is inert and Escape works without any
 * hand-rolled focus management.
 *
 * Closing goes through `requestClose`, which plays the exit animation and
 * then calls dialog.close(). The native `close` event is the ONE place that
 * finishes (calls `onClose`, once per opening) — because the browser can also
 * close the dialog itself: Chrome lets a page cancel only the first close
 * request (Escape, Android back) without user activation in between, and
 * then closes directly, with no exit animation. Under prefers-reduced-motion
 * the global CSS rule shortens the animations to ~0 ms; same flow.
 */
export function SheetDialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  testId,
  role,
  overlay,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  testId?: string;
  /** "alertdialog" for confirmations of destructive actions. */
  role?: AriaRole;
  /** Rendered outside the scrolling card (e.g. confetti that flies past it). */
  overlay?: ReactNode;
  children: (requestClose: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  // onClose fires once per opening, whichever path closed the dialog.
  const finished = useRef(false);

  // Reset the exit flag whenever the dialog is shown again. Adjusted during
  // render (React's recommended pattern) rather than in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setClosing(false);
  }

  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      finished.current = false;
      dialog.showModal();
      // showModal() focuses the first focusable element — the close button.
      // Prefer the control the dialog marks as its default action.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The page behind must not scroll under the sheet (iOS rubber-banding).
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  return (
    // Backdrop click-to-dismiss is a supplementary convenience: the native
    // dialog already closes on Escape and every dialog has a close button, so
    // keyboard users lose nothing.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-testid={testId}
      data-closing={closing || undefined}
      onCancel={(e) => {
        // Escape / back: animate out instead of the native instant close —
        // when the browser allows it. If it doesn't, it closes the dialog
        // itself and `onClose` below still finishes the job.
        if (!e.cancelable) return;
        e.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (finished.current) return;
        finished.current = true;
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      onAnimationEnd={(e) => {
        // The ::backdrop's animationend also targets the dialog itself —
        // only the box's own exit animation ends the closing.
        if (closing && e.target === e.currentTarget && !e.pseudoElement) {
          ref.current?.close();
        }
      }}
      className="sheet-dialog fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none overflow-visible bg-transparent p-0 text-ink backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:h-fit sm:w-[calc(100%-2rem)] sm:max-w-[440px]"
    >
      {overlay}
      <div className="max-h-[88dvh] overflow-y-auto border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.35)] sm:max-h-[85dvh] sm:border sm:pb-0 sm:shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]">
        {children(requestClose)}
      </div>
    </dialog>
  );
}

export function DialogCloseButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="press absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center text-mute transition-colors hover:text-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}
