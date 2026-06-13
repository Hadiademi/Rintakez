/** Brand wordmark — "Rintakez" with a terracotta accent period, per the Atelier design. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-medium tracking-tight text-ink ${className}`}>
      Rintakez<span className="text-accent">.</span>
    </span>
  );
}
