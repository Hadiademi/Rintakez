/**
 * Pure profile-completeness scorer for photographers.
 *
 * Framework-agnostic: the caller (a server component) queries the data and
 * hands this function plain booleans/counts/enum. It returns a 0–100 score and
 * a per-item breakdown the checklist card renders. NO DB access lives here so
 * it can be unit-tested in isolation.
 *
 * Weights sum to exactly 100:
 *   portfolio 25 · avatar 15 · bio 15 · verification 15 · rate 10 · cantons 10 · specialties 10
 */

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "rejected"
  | "verified";

export type ProfileCompletenessInput = {
  /** profiles.avatar_url present */
  hasAvatar: boolean;
  /** profiles.bio length in characters (counts at >=80) */
  bioLength: number;
  /** number of portfolio_images rows */
  portfolioCount: number;
  /** photographer_details.hourly_rate_chf present/>0 */
  hasRate: boolean;
  /** photographer_details.coverage_cantons length */
  cantonsCount: number;
  /** photographer_details.specialties length */
  specialtiesCount: number;
  /** photographer_details.verification_status */
  verificationStatus: VerificationStatus;
};

export type ChecklistItemKey =
  | "portfolio"
  | "avatar"
  | "bio"
  | "verification"
  | "rate"
  | "cantons"
  | "specialties";

export type ChecklistItem = {
  key: ChecklistItemKey;
  /** requirement fully met */
  done: boolean;
  /** points earned toward the score (may be partial for portfolio) */
  points: number;
  /** maximum points this item can contribute */
  weight: number;
  /** deep-link to the edit surface for this item */
  href: string;
};

export type ProfileCompleteness = {
  /** 0–100 integer */
  score: number;
  items: ChecklistItem[];
};

const BIO_MIN_CHARS = 80;
const PORTFOLIO_TARGET = 3;

/** Deep-links into the real edit surfaces (locale prefix is added by <Link>). */
// "#tab.anchor" — ProfileTabs selects the tab, then scrolls to and focuses
// the anchored element, so "write a short bio" lands ON the bio field.
const HREF = {
  avatar: "/profile#profile.profile-avatar",
  bio: "/profile#profile.basics-bio",
  portfolio: "/profile#profile.profile-portfolio",
  verification: "/profile#profile.profile-verification",
  rate: "/profile#profile.pro-rate",
  cantons: "/profile#profile.pro-cantons",
  specialties: "/profile#profile.pro-specialties",
} as const;

export function scoreProfileCompleteness(
  input: ProfileCompletenessInput
): ProfileCompleteness {
  const portfolioRatio = Math.min(input.portfolioCount, PORTFOLIO_TARGET) / PORTFOLIO_TARGET;
  const verificationDone =
    input.verificationStatus === "pending" ||
    input.verificationStatus === "verified";

  // Ordered by weight descending so the first missing items are the biggest wins.
  const items: ChecklistItem[] = [
    {
      key: "portfolio",
      done: input.portfolioCount >= PORTFOLIO_TARGET,
      points: portfolioRatio * 25,
      weight: 25,
      href: HREF.portfolio,
    },
    {
      key: "avatar",
      done: input.hasAvatar,
      points: input.hasAvatar ? 15 : 0,
      weight: 15,
      href: HREF.avatar,
    },
    {
      key: "bio",
      done: input.bioLength >= BIO_MIN_CHARS,
      points: input.bioLength >= BIO_MIN_CHARS ? 15 : 0,
      weight: 15,
      href: HREF.bio,
    },
    {
      key: "verification",
      done: verificationDone,
      points: verificationDone ? 15 : 0,
      weight: 15,
      href: HREF.verification,
    },
    {
      key: "rate",
      done: input.hasRate,
      points: input.hasRate ? 10 : 0,
      weight: 10,
      href: HREF.rate,
    },
    {
      key: "cantons",
      done: input.cantonsCount > 0,
      points: input.cantonsCount > 0 ? 10 : 0,
      weight: 10,
      href: HREF.cantons,
    },
    {
      key: "specialties",
      done: input.specialtiesCount > 0,
      points: input.specialtiesCount > 0 ? 10 : 0,
      weight: 10,
      href: HREF.specialties,
    },
  ];

  const score = Math.round(
    items.reduce((sum, i) => sum + i.points, 0)
  );

  return { score, items };
}
