"use server";

import { dbError } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { notifyEmail } from "@/lib/email";

type ErrResult = { ok: false; error: string };

const messageSchema = z.object({ body: z.string().min(1).max(4000) });

export type ConversationSummary = {
  id: string;
  shootId: string;
  shootTitle: string | null;
  otherName: string;
  otherId: string;
  otherAvatarUrl: string | null;
  lastMessageAt: string;
  lastBody: string | null;
  lastMine: boolean;
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
  otherAvatarUrl: string | null;
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
      "id, shoot_id, client_id, photographer_id, last_message_at, last_message_body, last_sender_id, client_last_read_at, photographer_last_read_at"
    )
    .order("last_message_at", { ascending: false });

  if (!convs || convs.length === 0) return [];

  const otherIds = convs.map((c) =>
    c.client_id === user.id ? c.photographer_id : c.client_id
  );
  const shootIds = convs.map((c) => c.shoot_id);

  // Previews come from the denormalized last_message_* columns (kept up to date
  // by the touch_conversation trigger), so we no longer read every message body.
  const [{ data: profiles }, { data: shoots }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", otherIds),
    supabase.from("shoots").select("id, title").in("id", shootIds),
  ]);

  const profileBy = new Map((profiles ?? []).map((p) => [p.id, p]));
  const titleBy = new Map((shoots ?? []).map((s) => [s.id, s.title]));

  function avatarUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  return convs.map((c) => {
    const isClient = c.client_id === user.id;
    const otherId = isClient ? c.photographer_id : c.client_id;
    const myReadAt = isClient
      ? c.client_last_read_at
      : c.photographer_last_read_at;
    const unread = !myReadAt || c.last_message_at > myReadAt;
    const other = profileBy.get(otherId);
    return {
      id: c.id,
      shootId: c.shoot_id,
      shootTitle: titleBy.get(c.shoot_id) ?? null,
      otherName: other?.display_name ?? "",
      otherId,
      otherAvatarUrl: avatarUrl(other?.avatar_url),
      lastMessageAt: c.last_message_at,
      lastBody: c.last_message_body ?? null,
      lastMine: c.last_sender_id ? c.last_sender_id === user.id : false,
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
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", otherId)
      .maybeSingle(),
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

  const rawAvatar = other?.avatar_url ?? null;
  const otherAvatarUrl = rawAvatar
    ? rawAvatar.startsWith("http://") || rawAvatar.startsWith("https://")
      ? rawAvatar
      : supabase.storage.from("avatars").getPublicUrl(rawAvatar).data.publicUrl
    : null;

  return {
    id: conv.id,
    shootId: conv.shoot_id,
    shootTitle: shoot?.title ?? null,
    otherName: other?.display_name ?? "",
    otherAvatarUrl,
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
): Promise<{ ok: true; message: ThreadMessage } | ErrResult> {
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  // Reject whitespace-only bodies that pass the raw min(1) length check.
  const body = parsed.data.body.trim();
  if (!body) return { ok: false, error: "invalid_input" };

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
    .select("client_id, photographer_id, shoot_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || (conv.client_id !== user.id && conv.photographer_id !== user.id))
    return { ok: false, error: "forbidden" };

  // Return the inserted row so the client can render the message immediately,
  // instead of waiting (forever, if the socket is down) for the realtime echo.
  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
    })
    .select("id, sender_id, body, created_at")
    .single();
  if (error || !inserted)
    return { ok: false, error: error ? dbError(error, "messages") : "generic" };

  // Mirror to email (gated + non-blocking; no-op without the service role).
  const recipientId =
    conv.client_id === user.id ? conv.photographer_id : conv.client_id;
  if (recipientId && recipientId !== user.id) {
    const { data: shoot } = await supabase
      .from("shoots")
      .select("title")
      .eq("id", conv.shoot_id)
      .maybeSingle();
    await notifyEmail({
      kind: "message_received",
      recipientId,
      shootId: conv.shoot_id,
      shootTitle: shoot?.title ?? null,
      // Collapse a back-and-forth thread into ~one email per 15 minutes so
      // recipients aren't trained to spam-mark the sender. shoot_id is a
      // sound dedupe key here because conversations.shoot_id is unique — one
      // conversation per shoot, so no cross-conversation collisions.
      dedupeWindowMs: 900_000,
    });
  }

  revalidatePath("/[locale]/(app)/messages/[id]", "page");
  revalidatePath("/[locale]/(app)/messages", "page");
  return {
    ok: true,
    message: {
      id: inserted.id,
      senderId: inserted.sender_id,
      body: inserted.body,
      createdAt: inserted.created_at,
    },
  };
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
  if (error) return { ok: false, error: dbError(error, "messages") };

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
  if (error) return { ok: false, error: dbError(error, "messages") };

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
  // SECURITY DEFINER RPC sets only the caller's own read marker — a participant
  // can no longer forge the other side's "last read" timestamp.
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) return { ok: false, error: dbError(error, "messages") };

  // Refresh the inbox so the unread dot clears without a full reload.
  revalidatePath("/[locale]/(app)/messages", "page");
  return { ok: true };
}
