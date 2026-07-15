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
          {...register("email")}
          className="w-full border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
        />
        {errors.email && (
          <p className="text-[12px] text-accent">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="label text-mute">
            {t("password")}
          </label>
          <Link
            href="/forgot-password"
            className="text-[12px] text-mute hover:text-ink"
          >
            {t("forgotLink")}
          </Link>
        </div>
        <input
          id="login-password"
          data-testid="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          className="w-full border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
        />
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
        className="press w-full bg-ink text-paper py-3.5 text-[14px] font-medium disabled:opacity-50 transition-opacity"
      >
        {t("submitLogin")}
      </button>
    </form>
  );
}
