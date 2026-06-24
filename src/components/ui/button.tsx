import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:opacity-90",
  secondary: "border border-line text-ink hover:border-ink",
  ghost: "text-ink hover:bg-chip",
  danger: "border border-accent/40 text-accent hover:border-accent hover:bg-accent/5",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-2 text-[13px]",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-sm",
};

/**
 * Shared button styling for the Atelier system. Use `buttonClass()` on a
 * `<Link>` (most navigation CTAs) or render `<Button>` for real buttons with a
 * built-in pending spinner. Keeps every CTA on the same ink/hairline language.
 */
export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  extra = ""
): string {
  return [
    "press inline-flex items-center justify-center gap-2 font-medium",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANT[variant],
    SIZE[size],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  className = "",
  children,
  disabled,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
