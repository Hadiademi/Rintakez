import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/wordmark";

const VISUAL =
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1100&h=1500&q=80";

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
  skipLabel,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tagline: string;
  skipLabel?: string;
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
      <section className="flex min-h-screen flex-col lg:px-12 lg:py-14">
        {/* Mobile photo hero banner — carries the wordmark + SKIP */}
        <div className="relative h-64 w-full shrink-0 overflow-hidden lg:hidden">
          <Image
            src={VISUAL}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover grayscale"
          />
          {/* Top: light darkening so the wordmark + SKIP stay legible. */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink/45 to-transparent" />
          {/* Bottom: the photo dissolves into the form's paper (matches the
              mockup's soft fade where the image meets the white below). */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-paper via-paper/70 to-transparent" />
          <div className="relative flex items-start justify-between p-6">
            <Link href="/">
              <Wordmark tone="paper" className="text-lg" />
            </Link>
            {skipLabel && (
              <Link
                href="/"
                className="label -mr-2 -mt-1 flex min-h-[44px] items-center px-2 text-paper/90 transition-opacity hover:opacity-70"
              >
                {skipLabel}
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-8 px-6 pt-8 pb-12 sm:px-12 lg:my-auto lg:px-0 lg:py-10">
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
