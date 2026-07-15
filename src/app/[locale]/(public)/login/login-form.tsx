"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { loginAction } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { errorKey } from "@/lib/error-messages";
import { useState } from "react";

export default function LoginForm() {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await loginAction(values);
    if (result.ok) {
      router.push("/home");
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
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="label text-mute">
          {t("email")}
        </label>
        <input
          id="login-email"
          data-testid="login-email"
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
        <label htmlFor="login-password" className="label text-mute">
          {t("password")}
        </label>
        <div className="relative">
          <input
            id="login-password"
            data-testid="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            {...register("password")}
            className="w-full border border-line bg-surface px-4 py-3 pr-12 text-[16px] text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
          />
          <button
            type="button"
            data-testid="login-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 right-0 flex min-h-[44px] w-11 items-center justify-center text-mute hover:text-ink transition-colors"
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
        <Link
          href="/forgot-password"
          className="self-end text-[12px] text-accent hover:opacity-70 transition-opacity"
        >
          {t("forgotLink")}
        </Link>
        {errors.password && (
          <p className="text-[12px] text-accent">{errors.password.message}</p>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <p className="text-[13px] text-accent">{serverError}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        data-testid="login-submit"
        disabled={isSubmitting}
        className="press flex w-full items-center justify-center gap-2 bg-ink text-paper py-3.5 text-[14px] font-medium disabled:opacity-50 transition-opacity"
      >
        {t("submitLogin")}
        <span aria-hidden="true">→</span>
      </button>
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
