import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/wordmark";

const VISUAL =
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1100&h=1500&q=80";

/**
 * Editorial split-screen frame for the auth pages (login / register).
 * Left: a full-height grayscale photographic panel with the wordmark and a
 * tagline. Right: the form column. On mobile the visual panel is hidden and the
 * wordmark moves to the top of the form column.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  tagline,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tagline: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Visual panel — desktop only */}
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src={VISUAL}
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-ink/45" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/">
            <Wordmark tone="paper" className="text-xl" />
          </Link>
          <p className="max-w-sm text-3xl font-semibold leading-[1.1] tracking-tight text-paper">
            {tagline}
          </p>
        </div>
      </aside>

      {/* Form column */}
      <section className="flex min-h-screen flex-col px-6 py-10 sm:px-12 lg:py-14">
        <div className="lg:hidden">
          <Link href="/">
            <Wordmark className="text-lg" />
          </Link>
        </div>

        <div className="m-auto flex w-full max-w-sm flex-col gap-8 py-10">
          <div className="flex flex-col gap-2">
            {eyebrow && <span className="label text-mute">{eyebrow}</span>}
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-ink">
              {title}
            </h1>
            {subtitle && <p className="text-[15px] text-mute">{subtitle}</p>}
          </div>

          {children}

          {footer}
        </div>
      </section>
    </main>
  );
}
