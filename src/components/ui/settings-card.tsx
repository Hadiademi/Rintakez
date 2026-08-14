/**
 * Settings card — the grouping primitive that gives the settings pages their
 * professional density (Stripe/Linear-style): a bordered card with a titled
 * header, an optional one-line description, the controls in the body, and an
 * optional right-aligned footer for actions.
 *
 * `danger` renders the destructive variant (terracotta border + title) used
 * for irreversible actions like account deletion.
 * `anchorId` doubles as the deep-link target for the mobile hub and the
 * "#tab.anchor" convention (see ProfileTabs).
 */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  danger = false,
  anchorId,
}: {
  /** Omit when the wrapped component renders its own heading row. */
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
  anchorId?: string;
}) {
  return (
    <section
      id={anchorId}
      className={`scroll-mt-24 border bg-paper ${
        danger ? "border-accent/40" : "border-line"
      }`}
    >
      {title ? (
        <div
          className={`border-b px-5 py-4 sm:px-6 ${
            danger ? "border-accent/40" : "border-line"
          }`}
        >
          <h3
            className={`text-[15px] font-semibold ${
              danger ? "text-accent" : "text-ink"
            }`}
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[13px] leading-relaxed text-mute">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {footer ? (
        <div
          className={`flex flex-wrap items-center justify-end gap-3 border-t bg-surface px-5 py-3 sm:px-6 ${
            danger ? "border-accent/40" : "border-line"
          }`}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}
