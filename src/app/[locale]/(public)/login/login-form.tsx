"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { loginAction } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { useState } from "react";

export default function LoginForm() {
  const t = useTranslations("auth");
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
      setServerError(
        result.error === "invalid_input" ? t("genericError") : result.error
      );
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
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
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
        <input
          id="login-password"
          data-testid="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
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
        className="press w-full rounded-lg bg-ink text-paper py-2.5 text-[14px] font-medium disabled:opacity-50 transition-opacity"
      >
        {t("submitLogin")}
      </button>
    </form>
  );
}
