import type { ReactNode } from "react";

/**
 * Centered empty state — a quiet mark, optional title, a short line, and an
 * optional action. Replaces bare gray sentences so "nothing here yet" reads as
 * finished, not broken.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-line px-6 py-16 text-center">
      <div className="text-mute-2" aria-hidden="true">
        {icon ?? <DefaultMark />}
      </div>
      {title && (
        <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
      )}
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-mute">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function DefaultMark() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 9h18M8 5V3M16 5V3" />
    </svg>
  );
}
