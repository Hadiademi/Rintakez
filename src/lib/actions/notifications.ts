"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

export type NotificationItem = {
  id: string;
  type: "bid_received" | "bid_accepted" | "bid_declined";
  shootId: string | null;
  title: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * Recent notifications for the current user (most recent first) plus the total
 * unread count. Shoot titles are resolved in a second query because the
 * notifications → shoots relationship is not embedded in the generated types.
 */
export async function getNotificationData(): Promise<{
  items: NotificationItem[];
  unread: number;
}> {
  const user = await getSessionUser();
  if (!user) return { items: [], unread: 0 };

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, type, shoot_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  const list = rows ?? [];

  const shootIds = [
    ...new Set(list.map((r) => r.shoot_id).filter((v): v is string => !!v)),
  ];

  const titles: Record<string, string> = {};
  if (shootIds.length) {
    const { data: shoots } = await supabase
      .from("shoots")
      .select("id, title")
      .in("id", shootIds);
    for (const s of shoots ?? []) titles[s.id] = s.title;
  }

  const items: NotificationItem[] = list.map((r) => ({
    id: r.id,
    type: r.type,
    shootId: r.shoot_id,
    title: r.shoot_id ? (titles[r.shoot_id] ?? null) : null,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .eq("user_id", user.id);

  return { items, unread: count ?? 0 };
}

/** Mark all of the current user's unread notifications as read. */
export async function markNotificationsRead(): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", user.id);

  return { ok: true };
}
