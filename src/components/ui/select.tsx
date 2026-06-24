import type { SelectHTMLAttributes } from "react";

/**
 * Styled native `<select>` — keeps native behaviour (and mobile pickers,
 * keyboard, a11y) but replaces the OS chrome with the Atelier hairline + a
 * custom chevron so filters stop looking like raw browser controls.
 */
export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-flex">
      <select
        className={`press appearance-none border border-line bg-surface py-2 pl-3 pr-9 text-[14px] text-ink transition-colors hover:border-mute-2 focus:border-ink focus:outline-none ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mute"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
