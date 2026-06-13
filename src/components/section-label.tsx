import type { ReactNode } from "react";

/** In-page section divider — "01 — Title" with a hairline rule extending right,
 *  optional action on the far right. Matches the Atelier "Deine Aufträge" pattern. */
export function SectionLabel({
  index,
  title,
  action,
}: {
  index?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <h2 className="label text-mute shrink-0">
        {index ? <span className="tabular">{index}</span> : null}
        {index ? <span className="mx-2 text-mute-2">—</span> : null}
        {title}
      </h2>
      <span className="h-px flex-1 bg-line" />
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Large editorial page heading — oversized tight title + optional count + rule. */
export function PageHeading({
  title,
  count,
}: {
  title: string;
  count?: ReactNode;
}) {
  return (
    <header>
      <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
        {title}
      </h1>
      {count !== undefined ? (
        <div className="mt-4 flex items-center gap-4">
          <span className="label tabular text-mute shrink-0">{count}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      ) : null}
    </header>
  );
}
