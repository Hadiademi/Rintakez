"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";
import { DialogCloseButton, SheetDialog } from "@/components/ui/sheet-dialog";
import { confettiPieces } from "@/lib/confetti";
import {
  browserMomentStorage,
  hasSeenMoment,
  markMomentSeen,
} from "@/lib/moment-once";

/**
 * Moments are the few big, rare events worth stopping the user for: a shoot
 * won, a photographer booked, a shoot gone live, a profile complete. Anything
 * smaller is a toast. Keeping them rare is what keeps them special.
 */

export type MomentAction = {
  label: string;
  /** Navigate (closes the moment); otherwise just closes and runs onClick. */
  href?: string;
  onClick?: () => void;
};

export type MomentEmblem = "check" | "star" | "spark" | "shield";

export type Moment = {
  /** Confetti or a quiet entrance. */
  tone?: "celebrate" | "calm";
  emblem?: MomentEmblem;
  eyebrow: string;
  title: string;
  body?: string;
  details?: { label: string; value: string }[];
  stepsTitle?: string;
  steps?: string[];
  primary: MomentAction;
  secondary?: MomentAction;
};

type MomentContextValue = { celebrate: (moment: Moment) => void };

const MomentContext = createContext<MomentContextValue | null>(null);

export function useMoment(): MomentContextValue {
  const ctx = useContext(MomentContext);
  if (!ctx) throw new Error("useMoment must be used within <MomentProvider>");
  return ctx;
}

/**
 * Lives in the layout, next to the toaster, so a moment survives the
 * client-side navigation or `router.refresh()` that usually follows the action
 * that triggered it (the triggering component often unmounts).
 */
export function MomentProvider({ children }: { children: ReactNode }) {
  // A queue, not a slot: two milestones can land on the same page view
  // (verification approved pushes the profile to 100%), and the second must
  // wait its turn instead of replacing the first.
  const [queue, setQueue] = useState<{ key: number; moment: Moment }[]>([]);

  const celebrate = useCallback((next: Moment) => {
    setQueue((q) => [...q, { key: ++momentCounter, moment: next }]);
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);
  const current = queue[0];

  return (
    <MomentContext.Provider value={value}>
      {children}
      {current && (
        <MomentDialog
          key={current.key}
          moment={current.moment}
          seed={current.key}
          onClose={() => setQueue((q) => q.slice(1))}
        />
      )}
    </MomentContext.Provider>
  );
}

// Unique per moment (React key + confetti seed); only needs to differ
// between moments within one page session.
let momentCounter = 0;

/**
 * Shows a moment once per device, for events the user learns about by opening
 * a page (their offer was accepted while they were away) rather than by their
 * own click. Renders nothing.
 */
export function ShowMomentOnce({
  id,
  moment,
  clearParam,
}: {
  id: string;
  moment: Moment;
  /** A one-shot query flag (e.g. ?published=1) to drop from the URL. */
  clearParam?: string;
}) {
  const { celebrate } = useMoment();
  useEffect(() => {
    if (clearParam) removeQueryParam(clearParam);
    const storage = browserMomentStorage();
    if (hasSeenMoment(storage, id)) return;
    markMomentSeen(storage, id);
    celebrate(moment);
    // `moment` is built inline by the caller; keying on the id alone keeps a
    // re-render from re-triggering it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, celebrate]);
  return null;
}

/**
 * Drops a one-shot flag from the address bar so a reload or a shared link
 * doesn't carry it. Passing `null` as state is what lets Next's patched
 * replaceState sync its router (as in the Next docs); passing the current
 * state (marked __NA) would skip the sync, and the next router.refresh()
 * would write the flag back.
 */
export function removeQueryParam(name: string): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(null, "", url);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function MomentDialog({
  moment,
  seed,
  onClose,
}: {
  moment: Moment;
  seed: number;
  onClose: () => void;
}) {
  const t = useTranslations("common");
  const titleId = useId();
  const bodyId = useId();
  // Decided once per moment: the burst is decoration, never essential.
  const [showConfetti] = useState(
    () => (moment.tone ?? "celebrate") === "celebrate" && !prefersReducedMotion()
  );

  return (
    <SheetDialog
      open
      onClose={onClose}
      labelledBy={titleId}
      describedBy={moment.body ? bodyId : undefined}
      testId="moment"
      overlay={showConfetti ? <Confetti seed={seed} /> : null}
    >
      {(requestClose) => (
        // Focus lands on the card itself, not a button: a moment often opens
        // on page load, where a focused CTA would show a keyboard focus ring
        // nobody asked for. Tab reaches the actions as usual.
        <div
          tabIndex={-1}
          data-autofocus
          className="relative px-6 pb-6 pt-9 text-center outline-none sm:px-9 sm:pb-8 sm:pt-11"
        >
          <DialogCloseButton label={t("close")} onClick={requestClose} />

          <Emblem kind={moment.emblem ?? "check"} />

          <p className="moment-rise label mt-6 text-accent" style={{ "--d": "120ms" } as CSSProperties}>
            {moment.eyebrow}
          </p>
          <h2
            id={titleId}
            className="moment-rise mx-auto mt-2 max-w-[22ch] text-balance text-[26px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[28px]"
            style={{ "--d": "170ms" } as CSSProperties}
          >
            {moment.title}
          </h2>
          {moment.body && (
            <p
              id={bodyId}
              className="moment-rise mx-auto mt-3 max-w-[36ch] text-pretty text-[15px] leading-relaxed text-mute"
              style={{ "--d": "220ms" } as CSSProperties}
            >
              {moment.body}
            </p>
          )}

          {moment.details && moment.details.length > 0 && (
            <dl
              className="moment-rise mt-6 divide-y divide-line border-y border-line text-left text-sm"
              style={{ "--d": "270ms" } as CSSProperties}
            >
              {moment.details.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-mute">{d.label}</dt>
                  <dd className="tabular min-w-0 break-words text-right font-medium text-ink">
                    {d.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {moment.steps && moment.steps.length > 0 && (
            <div
              className={`moment-rise text-left ${
                moment.details?.length ? "mt-5" : "mt-6 border-t border-line pt-5"
              }`}
              style={{ "--d": "300ms" } as CSSProperties}
            >
              {moment.stepsTitle && (
                <p className="label text-mute">{moment.stepsTitle}</p>
              )}
              <ol className="mt-3 space-y-3">
                {moment.steps.map((step, i) => (
                  <li key={step} className="flex gap-3.5">
                    <span className="tabular mt-[3px] text-[11px] font-semibold text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[14px] leading-snug text-ink">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div
            className="moment-rise mt-7 flex flex-col gap-1.5"
            style={{ "--d": "340ms" } as CSSProperties}
          >
            <MomentButton action={moment.primary} primary onDone={requestClose} />
            {moment.secondary && (
              <MomentButton action={moment.secondary} onDone={requestClose} />
            )}
          </div>
        </div>
      )}
    </SheetDialog>
  );
}

function MomentButton({
  action,
  primary = false,
  onDone,
}: {
  action: MomentAction;
  primary?: boolean;
  onDone: () => void;
}) {
  const className = primary
    ? buttonClass("primary", "lg", "w-full min-h-12")
    : "press inline-flex min-h-11 w-full items-center justify-center text-sm font-medium text-mute transition-colors hover:text-ink";
  if (action.href) {
    return (
      <Link
        href={action.href}
        className={className}
        onClick={() => {
          action.onClick?.();
          onDone();
        }}
      >
        {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        action.onClick?.();
        onDone();
      }}
    >
      {action.label}
    </button>
  );
}

function Emblem({ kind }: { kind: MomentEmblem }) {
  return (
    <div className="relative mx-auto h-[72px] w-[72px]">
      <span aria-hidden="true" className="moment-ring absolute inset-0 rounded-full border border-accent" />
      <span
        aria-hidden="true"
        className="moment-emblem absolute inset-0 grid place-items-center rounded-full bg-accent text-white shadow-[0_10px_30px_-8px_rgb(var(--accent-rgb)/0.6)]"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {kind === "check" && <path className="moment-draw" pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" />}
          {kind === "star" && (
            <path
              className="moment-draw"
              pathLength={1}
              d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"
            />
          )}
          {kind === "spark" && (
            <path
              className="moment-draw"
              pathLength={1}
              d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"
            />
          )}
          {kind === "shield" && (
            <>
              <path className="moment-draw" pathLength={1} d="M12 3l7 3v5.5c0 4.3-3 7.9-7 9.5-4-1.6-7-5.2-7-9.5V6z" />
              <path className="moment-draw moment-draw-late" pathLength={1} d="M8.8 12.2l2.3 2.3 4.3-4.6" />
            </>
          )}
        </svg>
      </span>
    </div>
  );
}

function Confetti({ seed }: { seed: number }) {
  const pieces = useMemo(() => confettiPieces(42, seed * 7919), [seed]);
  return (
    // Origin = the emblem's centre (card top padding + half the emblem).
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[calc(2.25rem+36px)] z-20 h-0 w-0 sm:top-[calc(2.75rem+36px)]"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          data-c={p.color}
          data-shape={p.shape}
          style={
            {
              "--x": `${p.x}px`,
              "--peak": `${p.peak}px`,
              "--fall": `${p.fall}px`,
              "--r": `${p.rotate}deg`,
              animationDelay: `${180 + p.delay}ms`,
              animationDuration: `${p.duration}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
