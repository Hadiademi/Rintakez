import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import NewShootForm from "./new-shoot-form";

export const dynamic = "force-dynamic";

export default async function NewShootPage() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }

  if (profile.role !== "client") {
    redirect({ href: "/home", locale });
    return null;
  }

  const t = await getTranslations("createShoot");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-medium tracking-tight text-ink">
        {t("title")}
      </h1>
      <NewShootForm />
    </div>
  );
}
