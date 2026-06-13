/** Presentational 5-star rating display. */
export function Stars({
  value,
  size = 14,
}: {
  value: number;
  size?: number;
}) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= rounded ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={i <= rounded ? "text-accent" : "text-line"}
          aria-hidden="true"
        >
          <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 21l1.4-6.8L2.2 9.6l6.9-.7z" />
        </svg>
      ))}
    </span>
  );
}
