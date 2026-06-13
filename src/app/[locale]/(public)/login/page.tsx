import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    registered?: string;
    confirm?: string;
    error?: string;
    reset?: string;
  }>;
}) {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (user) redirect({ href: "/home", locale });

  const { registered, confirm, error, reset } = await searchParams;
  const t = await getTranslations("auth");

  const notice = registered
    ? t("registeredSuccess")
    : confirm
      ? t("checkEmail")
      : reset
        ? t("passwordUpdated")
        : null;
  const errorNotice = error ? t("genericError") : null;

  return (
    <AuthShell
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      tagline={t("tagline")}
      footer={
        <p className="text-[13px] text-mute">
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="text-ink underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            {t("toRegister")}
          </Link>
        </p>
      }
    >
      {notice && (
        <p
          data-testid="login-notice"
          className="border-l-2 border-accent bg-surface px-4 py-3 text-[14px] text-ink"
        >
          {notice}
        </p>
      )}
      {errorNotice && (
        <p className="border-l-2 border-accent bg-surface px-4 py-3 text-[14px] text-accent">
          {errorNotice}
        </p>
      )}

      <GoogleButton />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="label text-mute-2">{t("orDivider")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <LoginForm />
    </AuthShell>
  );
}
