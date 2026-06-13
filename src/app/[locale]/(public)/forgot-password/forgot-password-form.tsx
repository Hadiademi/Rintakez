"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/${locale}/reset-password&locale=${locale}`;
    // Ignore the result to avoid leaking whether an account exists.
    await supabase.auth.resetPasswordForEmail(values.email, { redirectTo });
    setSent(true);
  }

  if (sent) {
    return (
      <p
        data-testid="reset-sent"
        className="border-l-2 border-accent bg-surface px-4 py-3 text-[14px] text-ink"
      >
        {t("resetEmailSent")}
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex w-full flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="label text-mute">
          {t("email")}
        </label>
        <input
          id="forgot-email"
          data-testid="forgot-email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className="w-full border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
        {errors.email && (
          <p className="text-[12px] text-accent">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        data-testid="forgot-submit"
        disabled={isSubmitting}
        className="press w-full bg-ink py-3.5 text-[14px] font-medium text-paper disabled:opacity-50"
      >
        {t("sendResetLink")}
      </button>
    </form>
  );
}
