// Pure queue logic for the toast system. Kept separate from the React layer so
// the dedup / max-3 / dismiss rules are unit-testable without a DOM.

export type Toast = { id: string; message: string };

export type ToastAction =
  | { type: "add"; toast: Toast }
  | { type: "dismiss"; id: string };

/** At most this many toasts are ever on screen at once. */
export const MAX_TOASTS = 3;

export function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "add": {
      // Dedup: a message already on screen shouldn't stack (e.g. a rapid
      // double-click). Return the same reference so React skips the re-render.
      if (state.some((t) => t.message === action.toast.message)) return state;
      // Cap the queue, dropping the oldest so the newest is always visible.
      return [...state, action.toast].slice(-MAX_TOASTS);
    }
    case "dismiss":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}
