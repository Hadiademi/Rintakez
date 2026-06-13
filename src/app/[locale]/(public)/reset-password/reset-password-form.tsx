"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/auth";

export default function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // The recovery link (via /auth/callback) established a session. If there is
  // none, the link was invalid or expired.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      setServerError(t("genericError"));
      return;
    }
    // The recovery session is now a normal authenticated session — send the
    // user straight into the app rather than forcing a re-login.
    router.push("/home");
    router.refresh();
  }

  if (hasSession === false) {
    return (
      <p className="border-l-2 border-accent bg-surface px-4 py-3 text-[14px] text-accent">
        {t("resetLinkInvalid")}
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
        <label htmlFor="reset-password" className="label text-mute">
          {t("newPassword")}
        </label>
        <input
          id="reset-password"
          data-testid="reset-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          className="w-full border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
        {errors.password && (
          <p className="text-[12px] text-accent">{errors.password.message}</p>
        )}
      </div>

      {serverError && <p className="text-[13px] text-accent">{serverError}</p>}

      <button
        type="submit"
        data-testid="reset-submit"
        disabled={isSubmitting || hasSession === null}
        className="press w-full bg-ink py-3.5 text-[14px] font-medium text-paper disabled:opacity-50"
      >
        {t("updatePassword")}
      </button>
    </form>
  );
}
