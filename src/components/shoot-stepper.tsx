import { getTranslations } from "next-intl/server";

type ShootStatus = "open" | "assigned" | "completed" | "cancelled";

/** Which existing CTA the stepper's one-line pointer nudges the owner toward. */
export type StepperHint = "invite" | "contact" | "review";

const STEPS = ["open", "assigned", "completed", "reviewed"] as const;

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Linear progress timeline for a shoot: Offen → Vergeben → Abgeschlossen →
 * Bewertet. Current step accented, done steps checkmarked, future steps muted.
 * Cancelled is a distinct terminal state, NOT a step. The optional `hint` is a
 * pointer to a CTA that already lives elsewhere on the page — it never dupes
 * that CTA's logic.
 */
export async function ShootStepper({
  status,
  hasReview,
  hint,
}: {
  status: ShootStatus;
  hasReview: boolean;
  hint?: StepperHint | null;
}) {
  const tShoot = await getTranslations("shoot");
  const t = await getTranslations("shootStepper");

  if (status === "cancelled") {
    return (
      <div className="space-y-2" data-testid="shoot-stepper-cancelled">
        <span className="label inline-block border border-line px-2 py-1 text-mute-2">
          {tShoot("status.cancelled")}
        </span>
        <p className="text-[13px] text-mute">{t("cancelledNote")}</p>
      </div>
    );
  }

  const currentIndex =
    status === "open" ? 0 : status === "assigned" ? 1 : hasReview ? 3 : 2;

  const labels: Record<(typeof STEPS)[number], string> = {
    open: tShoot("status.open"),
    assigned: tShoot("status.assigned"),
    completed: tShoot("status.completed"),
    reviewed: tShoot("status.reviewed"),
  };

  return (
    <div className="space-y-3" data-testid="shoot-stepper">
      <ol className="flex items-start" aria-label={t("aria")}>
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          const dotClass = done
            ? "border-ink bg-ink text-paper"
            : current
              ? "border-accent text-accent"
              : "border-line text-mute-2";
          const labelClass = current
            ? "text-accent"
            : done
              ? "text-ink"
              : "text-mute-2";
          const leftFilled = i > 0 && i <= currentIndex;
          const rightFilled = i < currentIndex;
          return (
            <li key={step} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span
                  className={`h-px flex-1 ${
                    i === 0 ? "invisible" : leftFilled ? "bg-ink" : "bg-line"
                  }`}
                />
                <span
                  aria-current={current ? "step" : undefined}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] tabular ${dotClass}`}
                >
                  {done ? <CheckIcon /> : i + 1}
                </span>
                <span
                  className={`h-px flex-1 ${
                    i === STEPS.length - 1
                      ? "invisible"
                      : rightFilled
                        ? "bg-ink"
                        : "bg-line"
                  }`}
                />
              </div>
              <span
                className={`mt-2 text-center text-[11px] leading-tight ${labelClass}`}
              >
                {labels[step]}
              </span>
            </li>
          );
        })}
      </ol>
      {hint ? (
        <p
          className="text-[13px] leading-relaxed text-mute"
          data-testid="shoot-stepper-hint"
        >
          {t(`hint.${hint}`)}
        </p>
      ) : null}
    </div>
  );
}
