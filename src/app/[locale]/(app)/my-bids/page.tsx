import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHF } from "@/lib/format";
import { shootImage } from "@/lib/shoot-image";
import { acceptanceRate } from "@/lib/bid-stats";
import { MyBidsList, type MyBidRow } from "@/components/my-bids-list";
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
  budget_min_chf: number;
  budget_max_chf: number;
}

interface BidWithShoot {
  id: string;
  amount_chf: number;
  message: string;
  status: BidStatus;
  created_at: string;
  shoot: ShootEmbed | ShootEmbed[] | null;
}

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

  const tMyBids = await getTranslations("myBids");

  const supabase = await createClient();

  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id,amount_chf,message,status,created_at,shoot:shoots!bids_shoot_id_fkey(id,title,type,location_city,canton,shoot_date,status,budget_min_chf,budget_max_chf)"
    )
    .eq("photographer_id", profile.id)
    .order("created_at", { ascending: false });

  // The generated types have no Relationships defined for bids, so we cast.
  const list = (bids ?? []) as unknown as BidWithShoot[];

  // Stats — computed over every fetched bid (mirrors the previous page's
  // list.length semantics rather than only the rows with a resolvable shoot).
  const activeCount = list.filter((b) => b.status === "pending").length;
  const wonCount = list.filter((b) => b.status === "accepted").length;
  const winRate = acceptanceRate(list);
  const volume = list
    .filter((b) => b.status === "accepted")
    .reduce((sum, b) => sum + b.amount_chf, 0);

  const stats: { key: string; label: string; value: string }[] = [
    { key: "active", label: tMyBids("statActive"), value: String(activeCount) },
    { key: "won", label: tMyBids("statWon"), value: String(wonCount) },
    {
      key: "winRate",
      label: tMyBids("statWinRate"),
      value: winRate === null ? "—" : `${Math.round(winRate * 100)}%`,
    },
    { key: "volume", label: tMyBids("statVolume"), value: formatCHF(volume) },
  ];

  const rows: MyBidRow[] = list.flatMap((bid) => {
    const shoot = Array.isArray(bid.shoot) ? bid.shoot[0] : bid.shoot;
    if (!shoot) return [];
    return [
      {
        id: bid.id,
        shootId: shoot.id,
        imageUrl: shootImage(shoot.type, shoot.id, 160, 120),
        locationCity: shoot.location_city,
        canton: shoot.canton,
        shootDate: shoot.shoot_date,
        title: shoot.title,
        createdAt: bid.created_at,
        budgetMin: shoot.budget_min_chf,
        budgetMax: shoot.budget_max_chf,
        amountChf: bid.amount_chf,
        status: bid.status,
        shootStatus: shoot.status,
      },
    ];
  });

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
      <header className="space-y-3">
        <p className="label text-mute">{tMyBids("eyebrow")}</p>
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          {tMyBids("title")}
        </h1>
        <p className="max-w-xl text-mute">{tMyBids("subtitle")}</p>
      </header>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-5 border border-line bg-surface py-20 text-center">
          <p className="text-mute">{tMyBids("empty")}</p>
          {browseCtaLink}
        </div>
      ) : (
        <>
          {/* 4-KPI stats grid — a 1px `bg-line` gap between `bg-paper` cells
              renders as a seamless hairline divider at any grid shape. */}
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.key} className="bg-paper p-5">
                <p className="label text-mute">{s.label}</p>
                <p className="tabular mt-1 text-3xl font-semibold text-ink sm:text-4xl">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <MyBidsList rows={rows} />
        </>
      )}
    </div>
  );
}
