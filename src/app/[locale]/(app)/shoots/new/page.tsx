import { getLocale } from "next-intl/server";
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

  return <NewShootForm />;
}
