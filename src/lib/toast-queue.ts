// Pure queue logic for the toast system. Kept separate from the React layer so
// the dedup / max-3 / dismiss / timing rules are unit-testable without a DOM.

export type ToastVariant = "success" | "error" | "info";

export type ToastAction = { label: string; href: string };

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Optional second line, e.g. what happens next. */
  description?: string;
  /** Optional follow-up link ("View offer →"). */
  action?: ToastAction;
};

export type ToastQueueAction =
  | { type: "add"; toast: Toast }
  | { type: "dismiss"; id: string };

/** At most this many toasts are ever on screen at once. */
export const MAX_TOASTS = 3;

export function toastReducer(state: Toast[], action: ToastQueueAction): Toast[] {
  switch (action.type) {
    case "add": {
      // Dedup: a toast already on screen shouldn't stack (e.g. a rapid
      // double-click). Return the same reference so React skips the re-render.
      // The second line counts: "New offer · Wedding" and "New offer ·
      // Portrait" are two different things to look at.
      const { message, variant, description } = action.toast;
      if (
        state.some(
          (t) =>
            t.message === message &&
            t.variant === variant &&
            t.description === description
        )
      ) {
        return state;
      }
      // Cap the queue, dropping the oldest so the newest is always visible.
      return [...state, action.toast].slice(-MAX_TOASTS);
    }
    case "dismiss":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

/**
 * How long a toast stays before it auto-dismisses (the timer pauses while the
 * pointer or focus is on it). A bare confirmation is a glance; an error, a
 * second line or a follow-up action needs time to be read and used.
 */
export function toastDuration(toast: Toast): number {
  return toast.variant === "error" || toast.action || toast.description
    ? 6000
    : 4000;
}
