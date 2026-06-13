"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

interface MobileTabBarProps {
  role: "client" | "photographer";
}

function HomeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function MobileTabBar({ role }: MobileTabBarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const clientTabs = [
    { href: "/home" as const, label: t("home"), icon: <HomeIcon /> },
    { href: "/shoots/new" as const, label: t("createShoot"), icon: <PlusIcon /> },
    { href: "/my-shoots" as const, label: t("myShoots"), icon: <ListIcon /> },
    { href: "/profile" as const, label: t("profile"), icon: <UserIcon /> },
  ];

  const photographerTabs = [
    { href: "/home" as const, label: t("home"), icon: <HomeIcon /> },
    { href: "/shoots" as const, label: t("browseShoots"), icon: <CameraIcon /> },
    { href: "/my-bids" as const, label: t("myBids"), icon: <ListIcon /> },
    { href: "/profile" as const, label: t("profile"), icon: <UserIcon /> },
  ];

  const tabs = role === "client" ? clientTabs : photographerTabs;

  return (
    <nav
      data-testid="mobile-nav"
      className="fixed bottom-0 inset-x-0 z-40 flex lg:hidden border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
              isActive ? "text-ink" : "text-mute"
            }`}
          >
            {icon}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
