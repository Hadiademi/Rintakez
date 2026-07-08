"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validation/auth";

export function ChangePasswordForm({ email }: { email: string }) {
  const t = useTranslations("profile");
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSubmit(values: ChangePasswordInput) {
    setServerError(null);
    setDone(false);
    const supabase = createClient();
    // Re-authenticate to confirm the current password before changing it.
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password: values.currentPassword,
    });
    if (signErr) {
      setServerError(t("currentPasswordWrong"));
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: values.newPassword,
    });
    if (error) {
      setServerError(t("genericError"));
      return;
    }
    reset();
    setDone(true);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 sm:max-w-md"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cur-pw" className="label text-mute">
          {t("currentPassword")}
        </label>
        <input
          id="cur-pw"
          type="password"
          autoComplete="current-password"
          {...register("currentPassword")}
          className="w-full border border-line bg-surface px-4 py-2.5 text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
        {errors.currentPassword && (
          <p className="text-[12px] text-accent">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-pw" className="label text-mute">
          {t("newPassword")}
        </label>
        <input
          id="new-pw"
          type="password"
          autoComplete="new-password"
          {...register("newPassword")}
          className="w-full border border-line bg-surface px-4 py-2.5 text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
        {errors.newPassword && (
          <p className="text-[12px] text-accent">{errors.newPassword.message}</p>
        )}
      </div>

      {serverError && <p className="text-[13px] text-accent">{serverError}</p>}
      {done && <p className="text-[13px] text-ink">{t("passwordChanged")}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="press self-start border border-line px-5 py-2.5 text-sm text-ink disabled:opacity-50"
      >
        {t("changePassword")}
      </button>
    </form>
  );
}
