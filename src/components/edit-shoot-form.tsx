"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createShootSchema, type CreateShootInput } from "@/lib/validation/shoot";
import { CANTONS, SHOOT_TYPES, DISCIPLINES } from "@/lib/validation/photographer";
import { updateShootAction } from "@/lib/actions/shoots";
import { errorKey } from "@/lib/error-messages";

const inputClass =
  "w-full border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 transition-colors focus:border-ink focus:outline-none";

export function EditShootForm({
  shootId,
  initial,
}: {
  shootId: string;
  initial: CreateShootInput;
}) {
  const t = useTranslations("createShoot");
  const tShoot = useTranslations("shoot");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateShootInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createShootSchema) as any,
    defaultValues: initial,
  });

  const discipline = useWatch({ control, name: "discipline" });

  async function onSubmit(values: CreateShootInput) {
    setServerError(null);
    const r = await updateShootAction(shootId, values);
    if (!r.ok) {
      setServerError(tErr(errorKey(r.error)));
      return;
    }
    router.push(`/shoots/${shootId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <span className="label text-mute">{tShoot("discipline")}</span>
        <div className="flex gap-2">
          {DISCIPLINES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setValue("discipline", d, { shouldValidate: true })}
              aria-pressed={discipline === d}
              className={`press flex-1 border px-5 py-3 text-sm font-medium transition-colors ${
                discipline === d
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-ink hover:border-mute-2"
              }`}
            >
              {tShoot(`disciplines.${d}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="e-type" className="label text-mute">{t("stepType")}</label>
        <select id="e-type" {...register("type")} className={inputClass}>
          {SHOOT_TYPES.map((v) => (
            <option key={v} value={v}>{tShoot(`types.${v}`)}</option>
          ))}
        </select>
        {errors.type && <p className="text-[13px] text-accent">{errors.type.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="e-title" className="label text-mute">{t("fieldTitle")}</label>
        <input id="e-title" {...register("title")} className={inputClass} />
        {errors.title && <p className="text-[13px] text-accent">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="e-brief" className="label text-mute">{t("fieldBrief")}</label>
        <textarea id="e-brief" rows={5} {...register("brief")} className={`${inputClass} resize-y`} />
        {errors.brief && <p className="text-[13px] text-accent">{errors.brief.message}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-city" className="label text-mute">{t("fieldCity")}</label>
          <input id="e-city" {...register("locationCity")} className={inputClass} />
          {errors.locationCity && <p className="text-[13px] text-accent">{errors.locationCity.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-postcode" className="label text-mute">{t("fieldPostcode")}</label>
          <input id="e-postcode" inputMode="numeric" maxLength={4} {...register("locationPostcode")} className={inputClass} />
          {errors.locationPostcode && <p className="text-[13px] text-accent">{errors.locationPostcode.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-canton" className="label text-mute">{t("fieldCanton")}</label>
          <select id="e-canton" {...register("canton")} className={inputClass}>
            {CANTONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.canton && <p className="text-[13px] text-accent">{errors.canton.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-date" className="label text-mute">{t("fieldDate")}</label>
          <input id="e-date" type="date" {...register("shootDate")} className={inputClass} />
          {errors.shootDate && <p className="text-[13px] text-accent">{errors.shootDate.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-duration" className="label text-mute">{t("fieldDuration")}</label>
          <input id="e-duration" type="number" min={1} max={24} {...register("durationHours", { valueAsNumber: true })} className={inputClass} />
          {errors.durationHours && <p className="text-[13px] text-accent">{errors.durationHours.message}</p>}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-bmin" className="label text-mute">{t("fieldBudgetMin")}</label>
          <input id="e-bmin" type="number" min={1} {...register("budgetMinChf", { valueAsNumber: true })} className={inputClass} />
          {errors.budgetMinChf && <p className="text-[13px] text-accent">{errors.budgetMinChf.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-bmax" className="label text-mute">{t("fieldBudgetMax")}</label>
          <input id="e-bmax" type="number" min={1} {...register("budgetMaxChf", { valueAsNumber: true })} className={inputClass} />
          {errors.budgetMaxChf && <p className="text-[13px] text-accent">{errors.budgetMaxChf.message}</p>}
        </div>
      </div>

      {serverError && <p className="text-[14px] text-accent">{serverError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="press self-start bg-ink px-7 py-3.5 text-sm font-medium text-paper disabled:opacity-50"
      >
        {t("saveChanges")}
      </button>
    </form>
  );
}
