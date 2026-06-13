/** Brand wordmark — "Rintakez" with a terracotta accent period, per the Atelier design. */
export function Wordmark({
  className = "",
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "paper";
}) {
  return (
    <span
      className={`font-medium tracking-tight ${
        tone === "paper" ? "text-paper" : "text-ink"
      } ${className}`}
    >
      Rintakez<span className="text-accent">.</span>
    </span>
  );
}
