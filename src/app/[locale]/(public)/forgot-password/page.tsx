import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth-shell";
import ForgotPasswordForm from "./forgot-password-form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth");
  const { error } = await searchParams;

  return (
    <AuthShell
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      tagline={t("tagline")}
      footer={
        <p className="text-[13px] text-mute">
          <Link
            href="/login"
            className="text-ink underline underline-offset-2 hover:opacity-70"
          >
            {t("toLogin")}
          </Link>
        </p>
      }
    >
      {error === "expired" && (
        <p
          data-testid="link-expired-banner"
          className="mb-5 border border-accent/40 bg-accent/5 px-4 py-3 text-[13px] text-accent"
        >
          {t("linkExpired")}
        </p>
      )}
      <ForgotPasswordForm />
    </AuthShell>
  );
}
