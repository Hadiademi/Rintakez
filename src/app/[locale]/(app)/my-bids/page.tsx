import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHF, formatSwissDate } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type BidStatus = Database["public"]["Enums"]["bid_status"];
type ShootType = Database["public"]["Enums"]["shoot_type"];
type ShootStatus = Database["public"]["Enums"]["shoot_status"];
type Canton = Database["public"]["Enums"]["canton"];

interface ShootEmbed {
  id: string;
  title: string;
  type: ShootType;
  location_city: string;
  canton: Canton;
  shoot_date: string;
  status: ShootStatus;
}

interface BidWithShoot {
  id: string;
  amount_chf: number;
  message: string;
  status: BidStatus;
  created_at: string;
  shoot: ShootEmbed | ShootEmbed[] | null;
}

const statusDotClass: Record<BidStatus, string> = {
  pending: "text-accent",
  accepted: "text-ink",
  declined: "text-mute",
  withdrawn: "text-mute-2",
};

export default async function MyBidsPage() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }

  if (profile.role !== "photographer") {
    redirect({ href: "/home", locale });
    return null;
  }

  const [tMyBids, tShoot, tBid] = await Promise.all([
    getTranslations("myBids"),
    getTranslations("shoot"),
    getTranslations("bid"),
  ]);

  const supabase = await createClient();

  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id,amount_chf,message,status,created_at,shoot:shoots!bids_shoot_id_fkey(id,title,type,location_city,canton,shoot_date,status)"
    )
    .eq("photographer_id", profile.id)
    .order("created_at", { ascending: false });

  // The generated types have no Relationships defined for bids, so we cast.
  const list = (bids ?? []) as unknown as BidWithShoot[];

  const browseCtaLink = (
    <Link
      href="/shoots"
      className="press inline-block bg-ink text-paper px-4 py-2 label"
    >
      {tMyBids("browseCta")}
    </Link>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <h1 className="text-3xl font-medium tracking-tight">
        {tMyBids("title")}
      </h1>

      {/* Empty state */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-mute">{tMyBids("empty")}</p>
          {browseCtaLink}
        </div>
      ) : (
        /* Bids list */
        <div
          data-testid="my-bids-list"
          className="grid gap-4 sm:grid-cols-2"
        >
          {list.map((bid) => {
            // Supabase embedded many-to-one may be typed as array; normalise.
            const shoot = Array.isArray(bid.shoot)
              ? bid.shoot[0]
              : bid.shoot;

            if (!shoot) return null;

            const dotClass = statusDotClass[bid.status] ?? "text-mute";

            return (
              <Link
                key={bid.id}
                href={`/shoots/${shoot.id}`}
                data-testid={`my-bid-${bid.id}`}
                className="block border border-line bg-surface p-5 hover:bg-paper transition-colors"
              >
                {/* Shoot type label */}
                <span className="label text-mute">
                  {tShoot(`types.${shoot.type}`)}
                </span>

                {/* Shoot title */}
                <h2 className="mt-2 text-lg font-medium tracking-tight text-ink">
                  {shoot.title}
                </h2>

                {/* Location and date */}
                <dl className="mt-3 space-y-1 text-sm text-mute">
                  <div className="flex justify-between">
                    <dt>{tShoot("location")}</dt>
                    <dd className="text-ink">
                      {shoot.location_city}, {shoot.canton}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{tShoot("date")}</dt>
                    <dd className="tabular text-ink">
                      {formatSwissDate(shoot.shoot_date)}
                    </dd>
                  </div>
                </dl>

                {/* Bid amount and status row */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="tabular text-ink font-medium">
                    {formatCHF(bid.amount_chf)}
                  </span>
                  <span className={`flex items-center gap-1.5 label ${dotClass}`}>
                    <span
                      aria-hidden="true"
                      className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                    />
                    {tBid(`status.${bid.status}`)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
