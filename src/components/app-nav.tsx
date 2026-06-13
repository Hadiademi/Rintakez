import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { NavLinks } from "@/components/nav-links";
import { NavSearch } from "@/components/nav-search";
import { Wordmark } from "@/components/wordmark";
import { NotificationBell } from "@/components/notification-bell";
import { getNotificationData } from "@/lib/actions/notifications";

interface AppNavProps {
  role: "client" | "photographer";
  displayName: string;
  userId: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function AppNav({
  role,
  displayName,
  userId,
  avatarUrl,
  isAdmin,
}: AppNavProps) {
  const t = await getTranslations("nav");
  const { items: notifItems, unread: notifUnread } =
    await getNotificationData();
  const adminLink = isAdmin
    ? ([{ href: "/admin", label: t("admin") }] as const)
    : ([] as const);

  const clientLinks = [
    { href: "/home", label: t("home") },
    { href: "/photographers", label: t("photographers") },
    { href: "/my-shoots", label: t("myShoots") },
    { href: "/messages", label: t("messages") },
    { href: "/profile", label: t("profile") },
  ] as const;

  const photographerLinks = [
    { href: "/home", label: t("home") },
    { href: "/shoots", label: t("browseShoots") },
    { href: "/my-bids", label: t("myBids") },
    { href: "/messages", label: t("messages") },
    { href: "/profile", label: t("profile") },
  ] as const;

  const links = [
    ...(role === "client" ? clientLinks : photographerLinks),
    ...adminLink,
  ];

  return (
    <>
      {/* Desktop top bar — hidden on mobile, shown on lg+ */}
      <nav className="hidden lg:block border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-8 py-4">
          {/* Left: brand + nav links */}
          <Link href="/home" className="text-lg shrink-0">
            <Wordmark />
          </Link>
          <NavLinks links={links} />

          {/* Search — grows to fill, capped */}
          <NavSearch className="ml-auto w-full max-w-sm" />

          {/* Right cluster */}
          <div className="flex items-center gap-3 shrink-0">
            <LocaleSwitcher />
            <ThemeToggle />
            <NotificationBell
              userId={userId}
              initialItems={notifItems}
              initialUnread={notifUnread}
            />
            {role === "client" && (
              <Link
                href="/shoots/new"
                className="press inline-flex items-center gap-1.5 bg-ink px-4 py-2.5 text-sm font-medium text-paper"
              >
                <span className="text-base leading-none">+</span>
                {t("create")}
              </Link>
            )}
            <Link
              href="/profile"
              aria-label={displayName}
              className="press flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-ink text-[11px] font-semibold tracking-wide text-paper"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover grayscale"
                />
              ) : (
                initials(displayName)
              )}
            </Link>
            <SignOutButton showTestId={true} />
          </div>
        </div>
      </nav>

      {/* Mobile top bar — shown on mobile, hidden on lg+ */}
      <nav className="flex lg:hidden border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/home" className="text-lg">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell
              userId={userId}
              initialItems={notifItems}
              initialUnread={notifUnread}
            />
            <LocaleSwitcher />
            <ThemeToggle />
            <SignOutButton showTestId={false} />
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — client component, lg:hidden */}
      <MobileTabBar role={role} />
    </>
  );
}
