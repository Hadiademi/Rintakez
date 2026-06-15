import { personaById } from "./personas";
import { getDemoUserId } from "./session";
import { getStore } from "./store";

// Mock of the SECURITY DEFINER Postgres functions the app calls via .rpc().
// Each mirrors the real state transition against the in-memory store.

type RpcResult = { data: any; error: { message: string } | null };

function emailFor(id: string): string {
  return personaById(id)?.email ?? `${id}@demo.ch`;
}

export async function rpc(fn: string, args: Record<string, any> = {}): Promise<RpcResult> {
  const s = getStore();

  switch (fn) {
    case "accept_bid": {
      const bid = s.bids.find((b) => b.id === args.p_bid_id);
      if (!bid) return { data: null, error: { message: "bid not found" } };
      const shoot = s.shoots.find((sh) => sh.id === bid.shoot_id);
      if (!shoot) return { data: null, error: { message: "shoot not found" } };
      shoot.status = "assigned";
      shoot.accepted_bid_id = bid.id;
      bid.status = "accepted";
      s.bids
        .filter((b) => b.shoot_id === shoot.id && b.id !== bid.id)
        .forEach((b) => (b.status = "declined"));
      if (!s.conversations.find((c) => c.shoot_id === shoot.id)) {
        const now = new Date().toISOString();
        s.conversations.push({
          id: crypto.randomUUID(),
          shoot_id: shoot.id,
          client_id: shoot.client_id,
          photographer_id: bid.photographer_id,
          created_at: now,
          last_message_at: now,
          client_last_read_at: null,
          photographer_last_read_at: null,
        });
      }
      return { data: null, error: null };
    }

    case "decline_bid": {
      const bid = s.bids.find((b) => b.id === args.p_bid_id);
      if (!bid) return { data: null, error: { message: "bid not found" } };
      bid.status = "declined";
      return { data: null, error: null };
    }

    case "complete_shoot": {
      const shoot = s.shoots.find((sh) => sh.id === args.p_shoot_id);
      if (!shoot) return { data: null, error: { message: "shoot not found" } };
      shoot.status = "completed";
      return { data: null, error: null };
    }

    case "shoot_bid_count": {
      const count = s.bids.filter((b) => b.shoot_id === args.p_shoot_id).length;
      return { data: count, error: null };
    }

    case "set_initial_role": {
      const uid = await getDemoUserId();
      const profile = uid ? s.profiles.find((p) => p.id === uid) : null;
      if (profile) {
        profile.role = args.p_role;
        profile.role_confirmed = true;
      }
      return { data: null, error: null };
    }

    case "get_counterparty_email": {
      const uid = await getDemoUserId();
      const shoot = s.shoots.find((sh) => sh.id === args.p_shoot_id);
      if (!shoot || !shoot.accepted_bid_id)
        return { data: null, error: { message: "no contact available" } };
      const bid = s.bids.find((b) => b.id === shoot.accepted_bid_id);
      const photographerId = bid?.photographer_id;
      if (uid === shoot.client_id && photographerId)
        return { data: emailFor(photographerId), error: null };
      if (uid === photographerId)
        return { data: emailFor(shoot.client_id), error: null };
      return { data: null, error: { message: "no contact available" } };
    }

    default:
      return { data: null, error: null };
  }
}
