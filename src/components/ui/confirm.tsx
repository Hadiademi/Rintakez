"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { DialogCloseButton, SheetDialog } from "@/components/ui/sheet-dialog";

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions get the accent button and default focus on Cancel. */
  tone?: "default" | "danger";
};

type ConfirmContextValue = {
  /** Resolves true on confirm, false on cancel / Escape / backdrop. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

/** Branded replacement for window.confirm ("localhost says…"). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const answer = useRef(false);

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second confirm while one is open cancels the first.
    resolver.current?.(false);
    answer.current = false;
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && (
        <ConfirmDialog
          open={open}
          options={options}
          onAnswer={(v) => {
            answer.current = v;
          }}
          onClose={() => {
            setOpen(false);
            // Resolve after the exit animation, so whatever the caller does
            // next (navigate, refresh, a toast) doesn't race the closing sheet.
            resolver.current?.(answer.current);
            resolver.current = null;
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  open,
  options,
  onAnswer,
  onClose,
}: {
  open: boolean;
  options: ConfirmOptions;
  onAnswer: (value: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations("common");
  const titleId = useId();
  const bodyId = useId();
  const danger = options.tone === "danger";

  return (
    <SheetDialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={options.body ? bodyId : undefined}
      testId="confirm-dialog"
      role={danger ? "alertdialog" : undefined}
    >
      {(requestClose) => {
        const choose = (value: boolean) => {
          onAnswer(value);
          requestClose();
        };
        const cancel = (
          <button
            type="button"
            data-testid="confirm-cancel"
            onClick={() => choose(false)}
            className={buttonClass("secondary", "lg", "min-h-12 w-full sm:w-auto")}
            {...(danger ? { "data-autofocus": true } : {})}
          >
            {options.cancelLabel ?? t("cancel")}
          </button>
        );
        const ok = (
          <button
            type="button"
            data-testid="confirm-ok"
            onClick={() => choose(true)}
            className={
              danger
                ? "press inline-flex min-h-12 w-full items-center justify-center border border-accent bg-accent px-6 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
                : buttonClass("primary", "lg", "min-h-12 w-full sm:w-auto")
            }
            {...(danger ? {} : { "data-autofocus": true })}
          >
            {options.confirmLabel}
          </button>
        );
        return (
          <div className="relative px-6 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
            <DialogCloseButton label={t("close")} onClick={() => choose(false)} />
            <h2
              id={titleId}
              className="pr-8 text-[20px] font-semibold leading-snug tracking-tight text-ink"
            >
              {options.title}
            </h2>
            {options.body && (
              <p id={bodyId} className="mt-2 text-[15px] leading-relaxed text-mute">
                {options.body}
              </p>
            )}
            {/* Thumb-reachable primary first on phones; desktop convention
                (Cancel left, action right) from sm up. */}
            <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <div className="order-1 sm:order-2">{ok}</div>
              <div className="order-2 sm:order-1">{cancel}</div>
            </div>
          </div>
        );
      }}
    </SheetDialog>
  );
}
