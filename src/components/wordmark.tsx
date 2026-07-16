/** Brand wordmark — "Framly" with a terracotta accent period, per the Atelier design. */
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
      Framly<span className="text-accent">.</span>
    </span>
  );
}
