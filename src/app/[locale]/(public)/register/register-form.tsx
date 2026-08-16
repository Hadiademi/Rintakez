"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { registerAction } from "@/lib/actions/auth";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { errorKey } from "@/lib/error-messages";
import {
  GoogleButton,
  GOOGLE_AUTH_ENABLED,
} from "@/components/google-button";
import { track } from "@/lib/track";
import { useState } from "react";

export default function RegisterForm() {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const locale = useLocale() as RegisterInput["locale"];
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      acceptTerms: false as unknown as true,
    },
  });

  const selectedRole = useWatch({ control, name: "role" });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    const result = await registerAction({ ...values, locale });
    if (result.ok) {
      track("signup");
      // Always land on the login page. `registered` = account is ready to use;
      // `confirm` = email confirmation is required first.
      router.push(result.session ? "/login?registered=1" : "/login?confirm=1");
      router.refresh();
    } else {
      setServerError(tErr(errorKey(result.error)));
    }
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
          className="w-full border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
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
          placeholder={t("emailPlaceholder")}
          {...register("email")}
          className="w-full border border-line bg-surface px-4 py-3 text-[16px] text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
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
        <div className="relative">
          <input
            id="register-password"
            data-testid="register-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            {...register("password")}
            className="w-full border border-line bg-surface px-4 py-3 pr-12 text-[16px] text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
          />
          <button
            type="button"
            data-testid="register-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 right-0 flex min-h-[44px] w-11 items-center justify-center text-mute hover:text-ink transition-colors"
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
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
              "press flex flex-col gap-1 border px-4 py-3 text-left transition-colors",
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
              "press flex flex-col gap-1 border px-4 py-3 text-left transition-colors",
              selectedRole === "photographer"
                ? "border-ink bg-surface"
                : "border-line bg-paper",
            ].join(" ")}
          >
            <span className="text-[14px] font-medium text-ink">
              {t("roleProTitle")}
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

      {/* Terms acceptance */}
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2.5 text-[13px] text-mute">
          <input
            type="checkbox"
            data-testid="register-accept-terms"
            {...register("acceptTerms")}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink,#111)]"
          />
          <span>
            {t.rich("termsAgree", {
              agb: (chunks) => (
                <Link
                  href="/agb"
                  target="_blank"
                  className="text-ink underline underline-offset-2"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/datenschutz"
                  target="_blank"
                  className="text-ink underline underline-offset-2"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-[12px] text-accent">{t("errorAcceptTerms")}</p>
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
        className="press flex w-full items-center justify-center gap-2 bg-ink text-paper py-3.5 text-[14px] font-medium disabled:opacity-50 transition-opacity"
      >
        {t("submitRegister")}
        <span aria-hidden="true">→</span>
      </button>

      {/* OAuth — uses the role selected above */}
      {GOOGLE_AUTH_ENABLED && (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="label text-mute-2">{t("orDivider")}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <GoogleButton role={selectedRole} />
          <p className="text-center text-[12px] text-mute-2">
            {t("googleConsent")}
          </p>
        </>
      )}
    </form>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
