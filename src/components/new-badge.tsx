/**
 * The small accent "New" chip on shoot cards and offers. Dark text on the
 * accent in both themes: white on the dark theme's lighter accent misses AA.
 */
export function NewBadge({
  label,
  testId,
  className = "",
}: {
  label: string;
  testId?: string;
  className?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={`label bg-accent px-1.5 py-0.5 text-paper ${className}`}
    >
      {label}
    </span>
  );
}
