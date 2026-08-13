import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shootImage } from "@/lib/shoot-image";
import { getShootCoverUrls } from "@/lib/shoot-cover";
import { getPublicShootCoverUrlsCached } from "@/lib/shoot-cover-cached";
import { MyShootsList, type MyShootRow } from "@/components/my-shoots-list";

export const dynamic = "force-dynamic";

export default async function MyShootsPage() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (profile.role !== "client") {
    redirect({ href: "/home", locale });
    return null;
  }

  const tMyShoots = await getTranslations("myShoots");
  const supabase = await createClient();

  const { data: shoots } = await supabase
    .from("shoots")
    .select(
      "id,title,type,location_city,canton,shoot_date,budget_min_chf,budget_max_chf,status"
    )
    .eq("client_id", profile.id)
    .order("created_at", { ascending: false });

  const shootList = shoots ?? [];

  // Active-offer counts in a single query (was one shoot_bid_count RPC per row).
  // Mirrors shoot_bid_count: count only pending + accepted bids. RLS lets the
  // owning client read bids on their own shoots.
  const shootIds = shootList.map((s) => s.id);
  const { data: bidRows } = shootIds.length
    ? await supabase
        .from("bids")
        .select("shoot_id, status")
        .in("shoot_id", shootIds)
        .in("status", ["pending", "accepted"])
    : { data: [] as { shoot_id: string; status: string }[] };
  const bidCountBy = new Map<string, number>();
  for (const b of bidRows ?? []) {
    bidCountBy.set(b.shoot_id, (bidCountBy.get(b.shoot_id) ?? 0) + 1);
  }

  // Stats — 4 KPI tiles computed over every fetched shoot.
  const activeCount = shootList.filter((s) => s.status === "open").length;
  const bookedCount = shootList.filter((s) => s.status === "assigned").length;
  const completedCount = shootList.filter((s) => s.status === "completed").length;
  const offersTotal = [...bidCountBy.values()].reduce((sum, n) => sum + n, 0);

  const stats: { key: string; label: string; value: string }[] = [
    { key: "active", label: tMyShoots("statActive"), value: String(activeCount) },
    { key: "offers", label: tMyShoots("statOffers"), value: String(offersTotal) },
    { key: "booked", label: tMyShoots("statBooked"), value: String(bookedCount) },
    {
      key: "completed",
      label: tMyShoots("statCompleted"),
      value: String(completedCount),
    },
  ];

  // The owner's own shoots — always show THEIR uploaded photo when present.
  // Open ones come from the cached public signer (stable, browser-cacheable
  // URLs); non-open statuses fall back to per-request authenticated signing.
  const covers = await getPublicShootCoverUrlsCached(shootIds);
  const missingCoverIds = shootIds.filter((id) => !covers.has(id));
  if (missingCoverIds.length > 0) {
    const own = await getShootCoverUrls(supabase, missingCoverIds);
    own.forEach((v, k) => covers.set(k, v));
  }

  const rows: MyShootRow[] = shootList.map((shoot) => ({
    id: shoot.id,
    imageUrl:
      covers.get(shoot.id) ?? shootImage(shoot.type, shoot.id, 160, 120),
    type: shoot.type,
    locationCity: shoot.location_city,
    canton: shoot.canton,
    shootDate: shoot.shoot_date,
    title: shoot.title,
    budgetMin: shoot.budget_min_chf,
    budgetMax: shoot.budget_max_chf,
    status: shoot.status,
    offerCount: bidCountBy.get(shoot.id) ?? 0,
  }));

  const createCtaLink = (
    <Link
      href="/shoots/new"
      data-testid="my-shoots-create"
      className="press inline-flex items-center gap-1.5 bg-ink px-5 py-2.5 text-paper label"
    >
      <span className="text-base leading-none">+</span>
      {tMyShoots("createCta")}
    </Link>
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="label text-mute">{tMyShoots("eyebrow")}</p>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {tMyShoots("title")}
          </h1>
          <p className="max-w-xl text-mute">{tMyShoots("subtitle")}</p>
        </div>
        <div className="shrink-0">{createCtaLink}</div>
      </header>

      {shootList.length === 0 ? (
        <div className="flex flex-col items-center gap-5 border border-line bg-surface py-20 text-center">
          <p className="text-mute">{tMyShoots("empty")}</p>
          {createCtaLink}
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

          <MyShootsList rows={rows} />
        </>
      )}
    </div>
  );
}
