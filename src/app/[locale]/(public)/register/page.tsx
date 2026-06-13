import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (user) redirect({ href: "/home", locale });

  const t = await getTranslations("auth");

  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-[26rem] flex flex-col gap-8">
        {/* Heading */}
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            {t("registerTitle")}
          </h1>
        </div>

        {/* Form */}
        <RegisterForm />

        {/* Footer link */}
        <p className="text-center text-[13px] text-mute">
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="text-ink underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            {t("toLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
