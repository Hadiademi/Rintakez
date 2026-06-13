import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth-shell";
import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <AuthShell
      title={t("resetTitle")}
      subtitle={t("resetSubtitle")}
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
      <ResetPasswordForm />
    </AuthShell>
  );
}
