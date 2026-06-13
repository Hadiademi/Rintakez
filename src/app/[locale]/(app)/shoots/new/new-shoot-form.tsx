"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createShootSchema, type CreateShootInput } from "@/lib/validation/shoot";
import { CANTONS, SHOOT_TYPES } from "@/lib/validation/photographer";
import { createShootAction } from "@/lib/actions/shoots";

const STEP_COUNT = 3;

// Fields per step — used for per-step validation gating
const STEP_FIELDS: Array<Array<keyof CreateShootInput>> = [
  ["type"],
  ["locationCity", "locationPostcode", "canton", "shootDate", "durationHours"],
  ["title", "brief", "budgetMinChf", "budgetMaxChf"],
];

export default function NewShootForm() {
  const t = useTranslations("createShoot");
  const tShoot = useTranslations("shoot");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  // Compute today's ISO date string at runtime (safe in client component)
  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CreateShootInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createShootSchema) as any,
    defaultValues: {
      type: undefined,
      durationHours: 4,
    },
    mode: "onTouched",
  });

  const selectedType = useWatch({ control, name: "type" });

  async function handleNext() {
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields);
    if (valid) setStep((s) => s + 1);
  }

  async function onSubmit(values: CreateShootInput) {
    setServerError(null);
    const result = await createShootAction(values);
    if (result.ok) {
      router.push(`/shoots/${result.id}`);
      router.refresh();
    } else {
      setServerError(t("errorCreate"));
    }
  }

  const stepHeadings = [t("stepType"), t("stepWhere"), t("stepDetails")];

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex flex-col gap-1">
        <p className="label text-mute">
          {t("stepLabel", { current: step + 1, total: STEP_COUNT })}
        </p>
        <h2 className="text-xl font-medium text-ink">{stepHeadings[step]}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {/* ── Step 0: Type of shoot ── */}
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {SHOOT_TYPES.map((v) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`shoot-type-${v}`}
                  onClick={() => setValue("type", v, { shouldValidate: true })}
                  className={[
                    "press flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
                    selectedType === v
                      ? "border-ink bg-surface"
                      : "border-line bg-paper",
                  ].join(" ")}
                >
                  <span className="text-[14px] font-medium text-ink capitalize">
                    {tShoot(`types.${v}`)}
                  </span>
                </button>
              ))}
            </div>
            {errors.type && (
              <p className="text-[12px] text-accent">{errors.type.message}</p>
            )}
          </div>
        )}

        {/* ── Step 1: Where and when ── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            {/* City */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-city" className="label text-mute">
                {t("fieldCity")}
              </label>
              <input
                id="shoot-city"
                data-testid="shoot-city"
                type="text"
                {...register("locationCity")}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
              />
              {errors.locationCity && (
                <p className="text-[12px] text-accent">{errors.locationCity.message}</p>
              )}
            </div>

            {/* Postcode */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-postcode" className="label text-mute">
                {t("fieldPostcode")}
              </label>
              <input
                id="shoot-postcode"
                data-testid="shoot-postcode"
                type="text"
                inputMode="numeric"
                maxLength={4}
                {...register("locationPostcode")}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
              />
              {errors.locationPostcode && (
                <p className="text-[12px] text-accent">{errors.locationPostcode.message}</p>
              )}
            </div>

            {/* Canton */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-canton" className="label text-mute">
                {t("fieldCanton")}
              </label>
              <select
                id="shoot-canton"
                data-testid="shoot-canton"
                {...register("canton")}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
              >
                <option value="" />
                {CANTONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.canton && (
                <p className="text-[12px] text-accent">{errors.canton.message}</p>
              )}
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-date" className="label text-mute">
                {t("fieldDate")}
              </label>
              <input
                id="shoot-date"
                data-testid="shoot-date"
                type="date"
                min={today}
                {...register("shootDate")}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
              />
              {errors.shootDate && (
                <p className="text-[12px] text-accent">{errors.shootDate.message}</p>
              )}
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-duration" className="label text-mute">
                {t("fieldDuration")}
              </label>
              <input
                id="shoot-duration"
                data-testid="shoot-duration"
                type="number"
                min={1}
                max={24}
                {...register("durationHours", { valueAsNumber: true })}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
              />
              {errors.durationHours && (
                <p className="text-[12px] text-accent">{errors.durationHours.message}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Details and budget ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-title" className="label text-mute">
                {t("fieldTitle")}
              </label>
              <input
                id="shoot-title"
                data-testid="shoot-title"
                type="text"
                {...register("title")}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
              />
              {errors.title && (
                <p className="text-[12px] text-accent">{errors.title.message}</p>
              )}
            </div>

            {/* Brief */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-brief" className="label text-mute">
                {t("fieldBrief")}
              </label>
              <textarea
                id="shoot-brief"
                data-testid="shoot-brief"
                rows={5}
                placeholder={t("briefPlaceholder")}
                {...register("brief")}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors resize-y"
              />
              {errors.brief && (
                <p className="text-[12px] text-accent">{errors.brief.message}</p>
              )}
            </div>

            {/* Budget min */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-budget-min" className="label text-mute">
                {t("fieldBudgetMin")}
              </label>
              <input
                id="shoot-budget-min"
                data-testid="shoot-budget-min"
                type="number"
                min={1}
                {...register("budgetMinChf", { valueAsNumber: true })}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
              />
              {errors.budgetMinChf && (
                <p className="text-[12px] text-accent">{errors.budgetMinChf.message}</p>
              )}
            </div>

            {/* Budget max */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-budget-max" className="label text-mute">
                {t("fieldBudgetMax")}
              </label>
              <input
                id="shoot-budget-max"
                data-testid="shoot-budget-max"
                type="number"
                min={1}
                {...register("budgetMaxChf", { valueAsNumber: true })}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
              />
              {errors.budgetMaxChf && (
                <p className="text-[12px] text-accent">{errors.budgetMaxChf.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Server error */}
        {serverError && (
          <p className="text-[13px] text-accent">{serverError}</p>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-2">
          {step > 0 && (
            <button
              type="button"
              data-testid="shoot-back"
              onClick={() => setStep((s) => s - 1)}
              className="press rounded-lg border border-line bg-paper px-5 py-2.5 text-[14px] font-medium text-ink transition-colors"
            >
              {t("back")}
            </button>
          )}

          {step < STEP_COUNT - 1 && (
            <button
              type="button"
              data-testid="shoot-next"
              onClick={handleNext}
              className="press rounded-lg bg-ink px-5 py-2.5 text-[14px] font-medium text-paper transition-opacity"
            >
              {t("next")}
            </button>
          )}

          {step === STEP_COUNT - 1 && (
            <button
              type="submit"
              data-testid="shoot-submit"
              disabled={isSubmitting}
              className="press rounded-lg bg-ink px-5 py-2.5 text-[14px] font-medium text-paper disabled:opacity-50 transition-opacity"
            >
              {t("submit")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
