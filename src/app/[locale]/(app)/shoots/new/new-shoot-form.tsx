"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { createShootSchema, type CreateShootInput } from "@/lib/validation/shoot";
import { CANTONS, SHOOT_TYPES } from "@/lib/validation/photographer";
import { createShootAction, addShootImage } from "@/lib/actions/shoots";
import { errorKey } from "@/lib/error-messages";

const STEP_COUNT = 3;
const MAX_REF_IMAGES = 6;

// Fields per step — used for per-step validation gating
const STEP_FIELDS: Array<Array<keyof CreateShootInput>> = [
  ["type"],
  ["locationCity", "locationPostcode", "canton", "shootDate", "durationHours"],
  ["title", "brief", "budgetMinChf", "budgetMaxChf"],
];

const inputClass =
  "w-full border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 transition-colors focus:border-ink focus:outline-none";

export default function NewShootForm() {
  const t = useTranslations("createShoot");
  const tShoot = useTranslations("shoot");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  // Reference images are held in memory and uploaded after the shoot is created
  // (the upload needs the new shoot id, which only exists post-insert).
  const [refImages, setRefImages] = useState<{ file: File; url: string }[]>([]);

  function addRefFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    setRefImages((prev) => {
      const room = MAX_REF_IMAGES - prev.length;
      const next = incoming
        .slice(0, Math.max(0, room))
        .map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...next];
    });
  }

  function removeRefImage(url: string) {
    setRefImages((prev) => {
      const target = prev.find((r) => r.url === url);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((r) => r.url !== url);
    });
  }

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
    defaultValues: { type: undefined, durationHours: 4 },
    mode: "onTouched",
  });

  const selectedType = useWatch({ control, name: "type" });

  async function handleNext() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => s + 1);
  }

  async function onSubmit(values: CreateShootInput) {
    setServerError(null);
    const result = await createShootAction(values);
    if (!result.ok) {
      setServerError(tErr(errorKey(result.error)));
      return;
    }
    // Upload any reference images now that we have the shoot id. Failures here
    // are non-fatal — the shoot already exists, so we still navigate to it.
    for (const { file } of refImages) {
      const fd = new FormData();
      fd.append("file", file);
      await addShootImage(result.id, fd);
    }
    router.push(`/shoots/${result.id}`);
    router.refresh();
  }

  const stepHeadings = [t("stepType"), t("stepWhere"), t("stepDetails")];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress bar + close */}
      <div className="flex items-center gap-6">
        <span className="label tabular shrink-0 text-mute">
          {String(step + 1).padStart(2, "0")} / {String(STEP_COUNT).padStart(2, "0")}
        </span>
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className={`h-px flex-1 transition-colors ${
                i <= step ? "bg-ink" : "bg-line"
              }`}
            />
          ))}
        </div>
        <Link
          href="/home"
          aria-label={t("back")}
          className="press shrink-0 text-mute hover:text-ink"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>

      {/* Step heading */}
      <h1 className="mt-12 text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
        {stepHeadings[step]}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-10 flex flex-col gap-5">
        {/* ── Step 0: Type of shoot — editorial option rows ── */}
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              {SHOOT_TYPES.map((v) => {
                const active = selectedType === v;
                return (
                  <button
                    key={v}
                    type="button"
                    data-testid={`shoot-type-${v}`}
                    onClick={() => setValue("type", v, { shouldValidate: true })}
                    aria-pressed={active}
                    className={`press flex items-center justify-between gap-4 border px-6 py-5 text-left transition-colors ${
                      active ? "border-ink bg-surface" : "border-line bg-paper hover:border-mute-2"
                    }`}
                  >
                    <span>
                      <span className="block text-lg font-semibold tracking-tight text-ink">
                        {tShoot(`types.${v}`)}
                      </span>
                      <span className="mt-1 block text-sm text-mute">
                        {tShoot(`typeDesc.${v}`)}
                      </span>
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center border transition-colors ${
                        active ? "border-accent bg-accent text-paper" : "border-line"
                      }`}
                    >
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.type && (
              <p className="text-[13px] text-accent">{errors.type.message}</p>
            )}
          </div>
        )}

        {/* ── Step 1: Where and when ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-city" className="label text-mute">{t("fieldCity")}</label>
              <input id="shoot-city" data-testid="shoot-city" type="text" {...register("locationCity")} className={inputClass} />
              {errors.locationCity && <p className="text-[13px] text-accent">{errors.locationCity.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-postcode" className="label text-mute">{t("fieldPostcode")}</label>
              <input id="shoot-postcode" data-testid="shoot-postcode" type="text" inputMode="numeric" maxLength={4} {...register("locationPostcode")} className={inputClass} />
              {errors.locationPostcode && <p className="text-[13px] text-accent">{errors.locationPostcode.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-canton" className="label text-mute">{t("fieldCanton")}</label>
              <select id="shoot-canton" data-testid="shoot-canton" {...register("canton")} className={inputClass}>
                <option value="" />
                {CANTONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.canton && <p className="text-[13px] text-accent">{errors.canton.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-date" className="label text-mute">{t("fieldDate")}</label>
              <input id="shoot-date" data-testid="shoot-date" type="date" min={today} {...register("shootDate")} className={inputClass} />
              {errors.shootDate && <p className="text-[13px] text-accent">{errors.shootDate.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-duration" className="label text-mute">{t("fieldDuration")}</label>
              <input id="shoot-duration" data-testid="shoot-duration" type="number" min={1} max={24} {...register("durationHours", { valueAsNumber: true })} className={inputClass} />
              {errors.durationHours && <p className="text-[13px] text-accent">{errors.durationHours.message}</p>}
            </div>
          </div>
        )}

        {/* ── Step 2: Details and budget ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-title" className="label text-mute">{t("fieldTitle")}</label>
              <input id="shoot-title" data-testid="shoot-title" type="text" {...register("title")} className={inputClass} />
              {errors.title && <p className="text-[13px] text-accent">{errors.title.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-brief" className="label text-mute">{t("fieldBrief")}</label>
              <textarea id="shoot-brief" data-testid="shoot-brief" rows={5} placeholder={t("briefPlaceholder")} {...register("brief")} className={`${inputClass} resize-y`} />
              {errors.brief && <p className="text-[13px] text-accent">{errors.brief.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-budget-min" className="label text-mute">{t("fieldBudgetMin")}</label>
              <input id="shoot-budget-min" data-testid="shoot-budget-min" type="number" min={1} {...register("budgetMinChf", { valueAsNumber: true })} className={inputClass} />
              {errors.budgetMinChf && <p className="text-[13px] text-accent">{errors.budgetMinChf.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shoot-budget-max" className="label text-mute">{t("fieldBudgetMax")}</label>
              <input id="shoot-budget-max" data-testid="shoot-budget-max" type="number" min={1} {...register("budgetMaxChf", { valueAsNumber: true })} className={inputClass} />
              {errors.budgetMaxChf && <p className="text-[13px] text-accent">{errors.budgetMaxChf.message}</p>}
            </div>

            {/* Reference images — optional */}
            <div className="flex flex-col gap-2">
              <span className="label text-mute">{t("fieldReferences")}</span>
              <p className="text-[13px] text-mute">{t("referencesHint")}</p>

              <div className="mt-1 flex flex-wrap gap-3">
                {refImages.map((img) => (
                  <div key={img.url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt=""
                      className="h-24 w-24 border border-line object-cover grayscale"
                    />
                    <button
                      type="button"
                      onClick={() => removeRefImage(img.url)}
                      className="press absolute right-1 top-1 border border-line bg-paper/80 px-1.5 py-0.5 text-xs text-ink opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {refImages.length < MAX_REF_IMAGES && (
                  <label className="press flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-line text-mute hover:border-mute-2 hover:text-ink">
                    <span className="text-2xl leading-none">+</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      data-testid="shoot-references-input"
                      onChange={(e) => {
                        addRefFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {serverError && <p className="text-[14px] text-accent">{serverError}</p>}

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-8">
          <button
            type="button"
            data-testid="shoot-back"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="press text-sm font-medium text-mute transition-colors hover:text-ink disabled:invisible"
          >
            {t("back")}
          </button>

          {step < STEP_COUNT - 1 ? (
            <button
              type="button"
              data-testid="shoot-next"
              onClick={handleNext}
              className="press inline-flex items-center gap-2 bg-ink px-7 py-3.5 text-sm font-medium text-paper"
            >
              {t("next")}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              data-testid="shoot-submit"
              disabled={isSubmitting}
              className="press inline-flex items-center gap-2 bg-ink px-7 py-3.5 text-sm font-medium text-paper disabled:opacity-50"
            >
              {t("submit")}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
