import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHF, formatSwissDate } from "@/lib/format";
import { PageHeading } from "@/components/section-label";
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
    <div className="space-y-10">
      <PageHeading title={tMyBids("title")} count={list.length} />

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-5 border border-line bg-surface py-20 text-center">
          <p className="text-mute">{tMyBids("empty")}</p>
          {browseCtaLink}
        </div>
      ) : (
        <div
          data-testid="my-bids-list"
          className="divide-y divide-line border-y border-line"
        >
          {list.map((bid) => {
            const shoot = Array.isArray(bid.shoot) ? bid.shoot[0] : bid.shoot;
            if (!shoot) return null;
            const dotClass = statusDotClass[bid.status] ?? "text-mute";

            return (
              <Link
                key={bid.id}
                href={`/shoots/${shoot.id}`}
                data-testid={`my-bid-${bid.id}`}
                className="press flex items-center justify-between gap-4 py-5"
              >
                <div className="min-w-0">
                  <p className="label uppercase text-mute">
                    {tShoot(`types.${shoot.type}`)} · {shoot.location_city},{" "}
                    {shoot.canton} · {formatSwissDate(shoot.shoot_date)}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                    {shoot.title}
                  </h2>
                  <p className="mt-0.5 tabular text-sm text-ink">
                    {formatCHF(bid.amount_chf)}
                  </p>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1.5 label ${dotClass}`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                  />
                  {tBid(`status.${bid.status}`)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
