"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

type ErrResult = { ok: false; error: string };

const messageSchema = z.object({ body: z.string().min(1).max(4000) });

export type ConversationSummary = {
  id: string;
  shootId: string;
  shootTitle: string | null;
  otherName: string;
  otherId: string;
  lastMessageAt: string;
  unread: boolean;
};

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type ThreadData = {
  id: string;
  shootId: string;
  shootTitle: string | null;
  otherName: string;
  otherId: string;
  meId: string;
  iBlocked: boolean;
  blockedByThem: boolean;
  messages: ThreadMessage[];
};

/** All conversations for the current user, newest activity first. */
export async function getConversations(): Promise<ConversationSummary[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data: convs } = await supabase
    .from("conversations")
    .select(
      "id, shoot_id, client_id, photographer_id, last_message_at, client_last_read_at, photographer_last_read_at"
    )
    .order("last_message_at", { ascending: false });

  if (!convs || convs.length === 0) return [];

  const otherIds = convs.map((c) =>
    c.client_id === user.id ? c.photographer_id : c.client_id
  );
  const shootIds = convs.map((c) => c.shoot_id);

  const [{ data: profiles }, { data: shoots }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", otherIds),
    supabase.from("shoots").select("id, title").in("id", shootIds),
  ]);

  const nameBy = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const titleBy = new Map((shoots ?? []).map((s) => [s.id, s.title]));

  return convs.map((c) => {
    const isClient = c.client_id === user.id;
    const otherId = isClient ? c.photographer_id : c.client_id;
    const myReadAt = isClient
      ? c.client_last_read_at
      : c.photographer_last_read_at;
    const unread = !myReadAt || c.last_message_at > myReadAt;
    return {
      id: c.id,
      shootId: c.shoot_id,
      shootTitle: titleBy.get(c.shoot_id) ?? null,
      otherName: nameBy.get(otherId) ?? "",
      otherId,
      lastMessageAt: c.last_message_at,
      unread,
    };
  });
}

/** Count of conversations with unread messages (for the nav badge). */
export async function getUnreadConversationCount(): Promise<number> {
  const convs = await getConversations();
  return convs.filter((c) => c.unread).length;
}

/** Full thread + participant context. Returns null if not a participant. */
export async function getThread(
  conversationId: string
): Promise<ThreadData | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, shoot_id, client_id, photographer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;

  const otherId =
    conv.client_id === user.id ? conv.photographer_id : conv.client_id;

  const [
    { data: messages },
    { data: other },
    { data: shoot },
    { data: myBlock },
    { data: blockedByThem },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle(),
    supabase.from("shoots").select("title").eq("id", conv.shoot_id).maybeSingle(),
    // My own block of them (RLS exposes only my own block rows).
    supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", otherId)
      .maybeSingle(),
    // Whether they blocked me — not visible via RLS, so via SECURITY DEFINER fn.
    supabase.rpc("blocked_by", { p_other: otherId }),
  ]);

  return {
    id: conv.id,
    shootId: conv.shoot_id,
    shootTitle: shoot?.title ?? null,
    otherName: other?.display_name ?? "",
    otherId,
    meId: user.id,
    iBlocked: !!myBlock,
    blockedByThem: blockedByThem ?? false,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
    })),
  };
}

export async function sendMessage(
  conversationId: string,
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await rateLimit(`msg:${user.id}`, 30, 60_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();
  // Defense-in-depth: confirm the caller actually belongs to the conversation
  // before inserting. RLS enforces this too, but checking here returns a clear
  // "forbidden" instead of a raw database error and avoids a wasted insert.
  const { data: conv } = await supabase
    .from("conversations")
    .select("client_id, photographer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || (conv.client_id !== user.id && conv.photographer_id !== user.id))
    return { ok: false, error: "forbidden" };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: parsed.data.body.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/messages/[id]", "page");
  revalidatePath("/[locale]/(app)/messages", "page");
  return { ok: true };
}

/** Block another user — they can no longer message the current user. */
export async function blockUser(
  targetId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (targetId === user.id) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_blocks")
    .upsert(
      { blocker_id: user.id, blocked_id: targetId },
      { onConflict: "blocker_id,blocked_id" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/messages/[id]", "page");
  return { ok: true };
}

/** Lift a block previously placed by the current user. */
export async function unblockUser(
  targetId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/messages/[id]", "page");
  return { ok: true };
}

/** Mark the conversation read for whichever side the caller is on. */
export async function markConversationRead(
  conversationId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: conv } = await supabase
    .from("conversations")
    .select("client_id, photographer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { ok: false, error: "not_found" };

  const patch =
    conv.client_id === user.id
      ? { client_last_read_at: now }
      : { photographer_last_read_at: now };

  await supabase.from("conversations").update(patch).eq("id", conversationId);
  return { ok: true };
}
