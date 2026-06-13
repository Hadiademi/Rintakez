import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (user) redirect({ href: "/home", locale });

  const t = await getTranslations("auth");

  return (
    <AuthShell
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      tagline={t("tagline")}
      footer={
        <p className="text-[13px] text-mute">
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="text-ink underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            {t("toLogin")}
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
