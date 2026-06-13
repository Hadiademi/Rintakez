import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { Wordmark } from "@/components/wordmark";

interface AppNavProps {
  role: "client" | "photographer";
  displayName: string;
}

export async function AppNav({ role, displayName }: AppNavProps) {
  const t = await getTranslations("nav");

  const clientLinks = [
    { href: "/home", label: t("home") },
    { href: "/shoots/new", label: t("createShoot") },
    { href: "/my-shoots", label: t("myShoots") },
    { href: "/profile", label: t("profile") },
  ] as const;

  const photographerLinks = [
    { href: "/home", label: t("home") },
    { href: "/shoots", label: t("browseShoots") },
    { href: "/my-bids", label: t("myBids") },
    { href: "/profile", label: t("profile") },
  ] as const;

  const links = role === "client" ? clientLinks : photographerLinks;

  return (
    <>
      {/* Desktop top bar — hidden on mobile, shown on lg+ */}
      <nav className="hidden lg:block border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Left: brand + nav links */}
          <div className="flex items-center gap-6">
            <Link href="/home" className="text-base">
              <Wordmark />
            </Link>
            <div className="flex items-center gap-4">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="label text-mute hover:text-ink"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: theme toggle + locale switcher + display name + sign out */}
          {/* SignOutButton with testid (desktop only) — keeps exactly one sign-out testid in DOM */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LocaleSwitcher />
            <span className="label text-mute-2">{displayName}</span>
            <SignOutButton showTestId={true} />
          </div>
        </div>
      </nav>

      {/* Mobile top bar — shown on mobile, hidden on lg+ */}
      <nav className="flex lg:hidden border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          {/* Left: brand */}
          <Link href="/home" className="text-base">
            <Wordmark />
          </Link>

          {/* Right: theme toggle + locale switcher + sign out (no testid) */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LocaleSwitcher />
            <SignOutButton showTestId={false} />
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — client component, lg:hidden */}
      <MobileTabBar role={role} />
    </>
  );
}
