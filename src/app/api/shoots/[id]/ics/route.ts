import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { buildShootIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

// Calendar file (.ics) for a booked shoot. Only the client and the assigned
// photographer of an assigned/completed shoot may download it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data: shoot } = await supabase
    .from("shoots")
    .select(
      "id, client_id, title, location_city, canton, shoot_date, status, accepted_bid_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!shoot || (shoot.status !== "assigned" && shoot.status !== "completed")) {
    return new NextResponse("not_found", { status: 404 });
  }

  // Participant check: client, or the accepted bid's photographer.
  let isParticipant = shoot.client_id === user.id;
  if (!isParticipant && shoot.accepted_bid_id) {
    const { data: bid } = await supabase
      .from("bids")
      .select("photographer_id")
      .eq("id", shoot.accepted_bid_id)
      .maybeSingle();
    isParticipant = bid?.photographer_id === user.id;
  }
  if (!isParticipant) return new NextResponse("forbidden", { status: 403 });

  const ics = buildShootIcs({
    uid: shoot.id,
    title: shoot.title,
    date: shoot.shoot_date,
    location: [shoot.location_city, shoot.canton].filter(Boolean).join(", "),
    description: shoot.title,
    stamp: new Date().toISOString(),
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rintakez-shoot.ics"`,
    },
  });
}
