import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatCHF } from "@/lib/format";
import type { Plan } from "@/lib/billing/plans";

/**
 * The photographer's tier-aware cockpit — the dashboard as the subscription's
 * shop window. Three principles:
 *  1. Speak the craft's language: offers, wins, francs — not funnel metrics.
 *  2. Free/Basic SEE what they're missing (honest locked previews of real,
 *     already-measured numbers — never fake data, never blocked core work).
 *  3. Paying tiers are REMINDED daily what they get (✓ rows) — the quiet
 *     anti-churn: when the invoice comes, the value list is already familiar.
 * Server component: everything is computed by the page and passed down.
 */
export async function PhotographerCockpit({
  tier,
  quotaUsed,
  quotaLimit,
  wonCount,
  wonSumChf,
  totalBids,
  views30d,
  benchmark,
  ownRate,
  viewers,
}: {
  tier: Plan;
  quotaUsed: number;
  quotaLimit: number;
  wonCount: number;
  wonSumChf: number;
  totalBids: number;
  /** null for tiers that don't fetch it (free/basic) */
  views30d: number | null;
  /** premium-only platform median acceptance rate (0..1), null while k-anon */
  benchmark: number | null;
  /** own acceptance rate (0..1), null with no bids */
  ownRate: number | null;
  /** premium-only "who viewed you" rows (clients with an open shoot) */
  viewers?: {
    viewer_name: string;
    viewer_city: string | null;
    view_count: number;
    last_view: string;
    shoot_id: string;
    shoot_title: string;
  }[];
}) {
  const t = await getTranslations("home");
  const paid = tier === "standard" || tier === "premium";
  const unlimited = !Number.isFinite(quotaLimit);
  const quotaPct = unlimited
    ? 100
    : quotaLimit === 0
      ? 0
      : Math.min(100, Math.round((quotaUsed / quotaLimit) * 100));

  const upsellHref = "/pricing";

  return (
    <section className="space-y-4" data-testid="photographer-cockpit">
      <div className="grid gap-4 sm:grid-cols-3">
        {/* ── Quota: the subscription made tangible, every single day ── */}
        <div className="border border-line bg-paper p-5">
          <p className="label text-mute">{t("cockpitQuotaLabel")}</p>
          <p className="mt-2 text-4xl font-semibold tabular tracking-tight text-ink">
            {unlimited ? "∞" : `${quotaUsed}/${quotaLimit}`}
          </p>
          <div className="mt-3 h-1.5 w-full bg-line">
            <div
              className={`h-1.5 ${quotaPct >= 100 && !unlimited ? "bg-accent" : "bg-ink"}`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          <p className="mt-3 text-[13px]">
            {tier === "free" && (
              <Link href={upsellHref} className="press text-accent hover:opacity-70">
                {t("cockpitQuotaUpgradeFree")} →
              </Link>
            )}
            {tier === "basic" && (
              <Link href={upsellHref} className="press text-accent hover:opacity-70">
                {t("cockpitQuotaUpgradeBasic")} →
              </Link>
            )}
            {tier === "standard" && (
              <span className="text-mute">{t("cockpitQuotaStandard")}</span>
            )}
            {tier === "premium" && (
              <span className="text-mute">{t("cockpitQuotaPremium")}</span>
            )}
          </p>
        </div>

        {/* ── Won: the queen metric — francs, not percentages ── */}
        <div className="border border-line bg-paper p-5">
          <p className="label text-mute">{t("cockpitWonLabel")}</p>
          <p className="mt-2 text-4xl font-semibold tabular tracking-tight text-ink">
            {wonCount}
          </p>
          <p className="mt-3 text-[15px] font-medium text-ink">
            {wonSumChf > 0 ? t("cockpitWonSum", { amount: formatCHF(wonSumChf) }) : " "}
          </p>
          <p className="mt-1 text-[13px] text-mute">
            {totalBids === 0
              ? t("cockpitWonNone")
              : totalBids >= 10 && ownRate !== null
                ? t("cockpitWonRate", { pct: Math.round(ownRate * 100) })
                : t("cockpitWonFraction", { won: wonCount, total: totalBids })}
          </p>
        </div>

        {/* ── Views: real for Standard+, an honest locked preview below ── */}
        {paid ? (
          <div className="border border-line bg-paper p-5">
            <p className="label text-mute">{t("cockpitViewsLabel")}</p>
            <p className="mt-2 text-4xl font-semibold tabular tracking-tight text-ink">
              {views30d ?? 0}
            </p>
            <p className="mt-3 text-[13px] text-mute">{t("cockpitViewsSub")}</p>
          </div>
        ) : (
          <Link
            href={upsellHref}
            data-testid="cockpit-views-locked"
            className="press block border border-line bg-surface p-5"
          >
            <p className="label flex items-center gap-1.5 text-mute">
              {t("cockpitViewsLabel")}
              <LockGlyph />
            </p>
            {/* The number exists and is being counted — it is simply not
                shown. Curiosity beats any banner; no fake digits. */}
            <p
              aria-hidden="true"
              className="mt-2 select-none text-4xl font-semibold tabular tracking-tight text-mute-2 blur-[6px]"
            >
              00
            </p>
            <p className="mt-3 text-[13px] text-accent">
              {t("cockpitViewsLocked")} →
            </p>
          </Link>
        )}
      </div>

      {/* ── Premium flagship: WHO viewed you — but only clients actively in
          the market (open shoot), so insight stays on the right side of
          privacy. The open shoot rides along → one tap from "they looked"
          to "here's my offer". ── */}
      {tier === "premium" && (
        <div
          className="border border-line bg-paper"
          data-testid="cockpit-viewers"
        >
          <p className="label flex items-center justify-between border-b border-line px-5 py-3 text-mute">
            {t("cockpitViewersTitle")}
            <span className="text-mute-2">{t("cockpitViewersWindow")}</span>
          </p>
          {(viewers ?? []).length === 0 ? (
            <p className="px-5 py-5 text-[14px] text-mute">
              {t("cockpitViewersEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {(viewers ?? []).map((v) => (
                <li key={v.shoot_id}>
                  <Link
                    href={`/shoots/${v.shoot_id}`}
                    className="press flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-surface"
                  >
                    <span className="text-[14.5px] font-medium text-ink">
                      {v.viewer_name}
                      {v.viewer_city ? (
                        <span className="font-normal text-mute"> · {v.viewer_city}</span>
                      ) : null}
                      {v.view_count > 1 ? (
                        <span className="font-normal text-mute"> · {v.view_count}×</span>
                      ) : null}
                    </span>
                    <span className="text-[13px] text-accent">
                      {t("cockpitViewersShoot", { title: v.shoot_title })} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── The perks band: what your plan does for you, visibly ── */}
      <div className="border border-line bg-paper" data-testid="cockpit-perks">
        <p className="label border-b border-line px-5 py-3 text-mute">
          {t("cockpitPerksLabel")}
        </p>
        <ul className="divide-y divide-line">
          <PerkRow
            active={paid}
            activeText={t("cockpitPerkAlertsActive")}
            lockedText={t("cockpitPerkAlertsLocked")}
            upsellHref={upsellHref}
          />
          <PerkRow
            active={paid}
            activeText={
              tier === "premium"
                ? t("cockpitPerkPlacementPremium")
                : t("cockpitPerkPlacementStandard")
            }
            lockedText={t("cockpitPerkPlacementLocked")}
            upsellHref={upsellHref}
          />
          {tier === "premium" ? (
            <PerkRow
              active
              activeText={
                benchmark !== null && ownRate !== null
                  ? t("cockpitPerkBenchmarkValue", {
                      median: Math.round(benchmark * 100),
                      own: Math.round(ownRate * 100),
                    })
                  : t("cockpitPerkBenchmarkCollecting")
              }
              lockedText=""
              upsellHref={upsellHref}
            />
          ) : tier === "standard" ? (
            <PerkRow
              active={false}
              activeText=""
              lockedText={t("cockpitPerkBenchmarkLocked")}
              upsellHref={upsellHref}
            />
          ) : null}
          {/* The premium flagship, teased for everyone below premium. */}
          {tier !== "premium" && (
            <PerkRow
              active={false}
              activeText=""
              lockedText={t("cockpitPerkViewersLocked")}
              upsellHref={upsellHref}
            />
          )}
        </ul>
      </div>
    </section>
  );
}

function PerkRow({
  active,
  activeText,
  lockedText,
  upsellHref,
}: {
  active: boolean;
  activeText: string;
  lockedText: string;
  upsellHref: string;
}) {
  return (
    <li>
      {active ? (
        <p className="flex items-start gap-2.5 px-5 py-3 text-[14px] text-ink">
          <span aria-hidden="true" className="mt-0.5 shrink-0 font-semibold text-ink">
            ✓
          </span>
          {activeText}
        </p>
      ) : (
        <Link
          href={upsellHref}
          className="press flex items-start gap-2.5 px-5 py-3 text-[14px] text-mute hover:text-ink"
        >
          <span aria-hidden="true" className="mt-0.5 shrink-0">
            <LockGlyph />
          </span>
          <span>
            {lockedText} <span className="text-accent">→</span>
          </span>
        </Link>
      )}
    </li>
  );
}

function LockGlyph() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-accent"
    >
      <rect x="4" y="11" width="16" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
