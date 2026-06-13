import { Link } from "@/i18n/navigation";

/** Dark editorial hero card — the signature Atelier "Neuen Auftrag erstellen" block.
 *  Ink background, tiny tracked label, oversized white headline, arrow, muted sub. */
export function HeroCta({
  label,
  title,
  desc,
  href,
}: {
  label: string;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="press group relative block overflow-hidden bg-ink p-8 sm:p-10"
    >
      <span className="label text-paper/55">{label}</span>
      <div className="mt-6 flex items-end justify-between gap-6">
        <h2 className="max-w-md text-3xl font-semibold leading-[1.08] tracking-tight text-paper sm:text-4xl">
          {title}
        </h2>
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          className="shrink-0 text-paper transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-paper/60">{desc}</p>
    </Link>
  );
}
