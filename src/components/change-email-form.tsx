"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { changeEmailSchema, type ChangeEmailInput } from "@/lib/validation/auth";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations("profile");
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({ resolver: zodResolver(changeEmailSchema) });

  async function onSubmit(values: ChangeEmailInput) {
    setServerError(null);
    setDone(false);
    if (values.email.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setServerError(t("emailSame"));
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: values.email });
    if (error) {
      setServerError(t("genericError"));
      return;
    }
    setDone(true);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 sm:max-w-md"
    >
      <div className="flex flex-col gap-1.5">
        <span className="label text-mute">{t("currentEmail")}</span>
        <span className="text-[15px] text-ink">{currentEmail}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-email" className="label text-mute">
          {t("newEmail")}
        </label>
        <input
          id="new-email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className="w-full border border-line bg-surface px-4 py-2.5 text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
        {errors.email && (
          <p className="text-[12px] text-accent">{errors.email.message}</p>
        )}
      </div>

      {serverError && <p className="text-[13px] text-accent">{serverError}</p>}
      {done && <p className="text-[13px] text-ink">{t("emailChangePending")}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="press self-start border border-line px-5 py-2.5 text-sm text-ink disabled:opacity-50"
      >
        {t("changeEmail")}
      </button>
    </form>
  );
}
