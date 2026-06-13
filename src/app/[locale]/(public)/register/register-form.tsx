"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { registerAction } from "@/lib/actions/auth";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { errorKey } from "@/lib/error-messages";
import { useState } from "react";

export default function RegisterForm() {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const locale = useLocale() as RegisterInput["locale"];
  const router = useRouter();
  const [checkEmail, setCheckEmail] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "client",
      locale,
    },
  });

  const selectedRole = useWatch({ control, name: "role" });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    const result = await registerAction({ ...values, locale });
    if (result.ok) {
      if (result.session) {
        router.push("/home");
        router.refresh();
      } else {
        setCheckEmail(true);
      }
    } else {
      setServerError(tErr(errorKey(result.error)));
    }
  }

  if (checkEmail) {
    return (
      <div
        data-testid="register-check-email"
        className="text-center py-8 px-4"
      >
        <p className="text-ink">{t("checkEmail")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5 w-full"
    >
      {/* Display name */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="register-displayName"
          className="label text-mute"
        >
          {t("displayName")}
        </label>
        <input
          id="register-displayName"
          data-testid="register-displayName"
          type="text"
          autoComplete="name"
          {...register("displayName")}
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
        />
        {errors.displayName && (
          <p className="text-[12px] text-accent">{errors.displayName.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-email" className="label text-mute">
          {t("email")}
        </label>
        <input
          id="register-email"
          data-testid="register-email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
        />
        {errors.email && (
          <p className="text-[12px] text-accent">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-password" className="label text-mute">
          {t("password")}
        </label>
        <input
          id="register-password"
          data-testid="register-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
        />
        {errors.password && (
          <p className="text-[12px] text-accent">{errors.password.message}</p>
        )}
      </div>

      {/* Role segmented control */}
      <div className="flex flex-col gap-2">
        <span className="label text-mute">{t("roleQuestion")}</span>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Client option */}
          <button
            type="button"
            data-testid="register-role-client"
            onClick={() => setValue("role", "client", { shouldValidate: true })}
            className={[
              "press flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
              selectedRole === "client"
                ? "border-ink bg-surface"
                : "border-line bg-paper",
            ].join(" ")}
          >
            <span className="text-[14px] font-medium text-ink">
              {t("roleClient")}
            </span>
            <span className="text-[12px] text-mute">{t("roleClientHint")}</span>
          </button>

          {/* Photographer option */}
          <button
            type="button"
            data-testid="register-role-photographer"
            onClick={() =>
              setValue("role", "photographer", { shouldValidate: true })
            }
            className={[
              "press flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
              selectedRole === "photographer"
                ? "border-ink bg-surface"
                : "border-line bg-paper",
            ].join(" ")}
          >
            <span className="text-[14px] font-medium text-ink">
              {t("rolePhotographer")}
            </span>
            <span className="text-[12px] text-mute">
              {t("rolePhotographerHint")}
            </span>
          </button>
        </div>
        {errors.role && (
          <p className="text-[12px] text-accent">{errors.role.message}</p>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <p className="text-[13px] text-accent">{serverError}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        data-testid="register-submit"
        disabled={isSubmitting}
        className="press w-full rounded-lg bg-ink text-paper py-2.5 text-[14px] font-medium disabled:opacity-50 transition-opacity"
      >
        {t("submitRegister")}
      </button>
    </form>
  );
}
