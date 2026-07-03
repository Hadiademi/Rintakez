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

/** Private bucket for chat photo attachments (see the message_images migration).
 *  Not exported: a "use server" file may only export async functions. */
const MESSAGE_IMAGE_BUCKET = "message-images";
/** Signed-URL lifetime for chat images (seconds). Long enough to view a thread
 *  and open the lightbox; the thread re-signs on every load. */
const MESSAGE_IMAGE_TTL = 3600;
/** Post-compression upload ceiling — mirrors the client-side canvas downscale.
 *  Enforced server-side too so a crafted request can't smuggle a large file. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** A Supabase client as returned by our server helper. Compile-time only. */
type ServerClient = Awaited<ReturnType<typeof createClient>>;

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
  /** The last message was an image-only attachment (empty body, but a message
   *  exists). Drives a "📷 Photo" preview instead of a blank line. */
  lastIsPhoto: boolean;
};

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  /** Storage path of an attached image (private bucket), or null for text. */
  imagePath: string | null;
  /** Short-lived signed URL for `imagePath`, minted server-side. Null when the
   *  message has no image (or the URL couldn't be signed). */
  imageUrl: string | null;
};

/** Shape of a message row selected from the DB (snake_case). */
type MessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  image_path: string | null;
};

/** Map DB message rows to ThreadMessages, batch-signing any image paths into
 *  short-lived URLs (the bucket is private). Rows without an image pass through
 *  with null URLs and no storage round-trip. */
async function toThreadMessages(
  supabase: ServerClient,
  rows: MessageRow[]
): Promise<ThreadMessage[]> {
  const paths = rows
    .map((r) => r.image_path)
    .filter((p): p is string => !!p);

  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(MESSAGE_IMAGE_BUCKET)
      .createSignedUrls(paths, MESSAGE_IMAGE_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
    imagePath: r.image_path,
    imageUrl: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
  }));
}

/** Newest-page size for a thread's initial load and each "load earlier" page.
 *  Not exported: a "use server" file may only export async functions (plus
 *  types, which are compile-time only) — a value export breaks the server
 *  actions build. */
const THREAD_PAGE = 50;

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
  /**
   * True when the initial load returned a full page (THREAD_PAGE messages),
   * meaning there may be older messages not yet loaded. Drives the "load
   * earlier messages" affordance in message-thread.tsx.
   */
  hasMore: boolean;
  /**
   * When the OTHER participant last read this conversation (ISO), or null if
   * they never have. Drives read receipts on my own messages: a message is
   * "read" once its created_at <= otherLastReadAt, otherwise merely "sent".
   * Derived from the initial load; realtime updates to it aren't subscribed
   * (see message-thread.tsx), so a receipt flips to ✓✓ on the next thread open.
   */
  otherLastReadAt: string | null;
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
      // Text messages always have a non-empty body (trimmed server-side), so an
      // empty body alongside an actual sender means the last message was an
      // image-only attachment.
      lastIsPhoto: !!c.last_sender_id && !c.last_message_body,
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
    .select(
      "id, shoot_id, client_id, photographer_id, client_last_read_at, photographer_last_read_at"
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;

  const iAmClient = conv.client_id === user.id;
  const otherId = iAmClient ? conv.photographer_id : conv.client_id;
  // The OTHER side's read marker — if I'm the client, that's the photographer's.
  const otherLastReadAt = iAmClient
    ? conv.photographer_last_read_at
    : conv.client_last_read_at;

  const [
    { data: messages },
    { data: other },
    { data: shoot },
    { data: myBlock },
    { data: blockedByThem },
  ] = await Promise.all([
    // Newest page only (pagination — see loadEarlierMessages for older pages).
    // Fetched newest-first so `.limit` keeps the most recent N, then reversed
    // below to ascending order for rendering.
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at, image_path")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(THREAD_PAGE),
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
    otherLastReadAt: otherLastReadAt ?? null,
    // Reverse the newest-first page back to ascending (oldest → newest) for
    // rendering; a full page means there may be older messages still unread.
    hasMore: (messages?.length ?? 0) === THREAD_PAGE,
    // Reverse the newest-first page back to ascending, then sign image paths.
    messages: await toThreadMessages(
      supabase,
      (messages ?? []).slice().reverse()
    ),
  };
}

export type EarlierMessagesResult = {
  messages: ThreadMessage[];
  hasMore: boolean;
};

const cursorSchema = z.object({
  conversationId: z.string().uuid(),
  beforeCreatedAt: z.string().datetime({ offset: true }),
  beforeId: z.string().uuid(),
});

/**
 * Previous page of a thread, strictly older than the given cursor
 * (created_at, id) — used by the "load earlier messages" affordance once the
 * initial getThread page has been exhausted. RLS already restricts messages
 * to conversation participants, but we still confirm participation up front
 * (same pattern as getThread) so a non-participant gets a clean null instead
 * of relying solely on RLS to return an empty set.
 */
export async function loadEarlierMessages(
  conversationId: string,
  beforeCreatedAt: string,
  beforeId: string
): Promise<EarlierMessagesResult | null> {
  // Cursor values are interpolated into a PostgREST `.or()` filter string
  // below, so they're strictly shape-validated first (UUID / ISO timestamp)
  // as a hard guard against filter-syntax injection — not just relying on
  // the query builder's own escaping.
  const parsed = cursorSchema.safeParse({
    conversationId,
    beforeCreatedAt,
    beforeId,
  });
  if (!parsed.success) return null;

  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("client_id, photographer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || (conv.client_id !== user.id && conv.photographer_id !== user.id))
    return null;

  // Cursor pagination on (created_at, id): strictly-older created_at, OR the
  // same created_at with a strictly-smaller id (tie-break for same-timestamp
  // messages). Values were shape-validated above (UUID / ISO datetime), so
  // this interpolation cannot smuggle extra filter clauses.
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at, image_path")
    .eq("conversation_id", conversationId)
    .or(
      `created_at.lt.${beforeCreatedAt},and(created_at.eq.${beforeCreatedAt},id.lt.${beforeId})`
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(THREAD_PAGE);

  return {
    hasMore: (messages?.length ?? 0) === THREAD_PAGE,
    messages: await toThreadMessages(
      supabase,
      (messages ?? []).slice().reverse()
    ),
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
    .select("id, sender_id, body, created_at, image_path")
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
      imagePath: inserted.image_path,
      imageUrl: null,
    },
  };
}

/**
 * Send a photo message. The client downscales the image (canvas) and posts the
 * compressed blob here as `file` in a FormData, plus an optional `body` caption.
 * We re-validate MIME + size server-side, upload to the private message-images
 * bucket under `<conversationId>/<uuid>.<ext>`, insert the message row, and
 * return it with a fresh signed URL for immediate render. Shares the text
 * message rate limit and the participant/block enforcement (via RLS + an
 * explicit up-front check).
 */
export async function sendImageMessage(
  conversationId: string,
  formData: FormData
): Promise<{ ok: true; message: ThreadMessage } | ErrResult> {
  if (!z.string().uuid().safeParse(conversationId).success)
    return { ok: false, error: "invalid_input" };

  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    !file.type.startsWith("image/") ||
    file.size > MAX_IMAGE_BYTES
  ) {
    return { ok: false, error: "invalid_file" };
  }

  // Optional caption. Empty is fine (image-only); the DB CHECK allows an empty
  // body when image_path is present.
  const rawBody = formData.get("body");
  const body =
    typeof rawBody === "string" ? rawBody.trim().slice(0, 4000) : "";

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await rateLimit(`msg:${user.id}`, 30, 60_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("client_id, photographer_id, shoot_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || (conv.client_id !== user.id && conv.photographer_id !== user.id))
    return { ok: false, error: "forbidden" };

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(MESSAGE_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError)
    return { ok: false, error: dbError(uploadError, "messages") };

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      image_path: path,
    })
    .select("id, sender_id, body, created_at, image_path")
    .single();
  if (error || !inserted) {
    // Roll back the orphaned object so a failed insert doesn't leak storage.
    await supabase.storage.from(MESSAGE_IMAGE_BUCKET).remove([path]);
    return { ok: false, error: error ? dbError(error, "messages") : "generic" };
  }

  const [signedMessage] = await toThreadMessages(supabase, [inserted]);

  // Mirror to email (same collapse window as text; the notification copy works
  // without embedding the image).
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
      dedupeWindowMs: 900_000,
    });
  }

  revalidatePath("/[locale]/(app)/messages/[id]", "page");
  revalidatePath("/[locale]/(app)/messages", "page");
  return { ok: true, message: signedMessage };
}

/**
 * Mint a signed URL for a single message's image, gated on the caller being a
 * participant of that message's conversation. Used by the realtime path: an
 * incoming INSERT carries the image_path but not a signed URL, so the client
 * fetches one here. Returns null when the message has no image or the caller
 * isn't a participant.
 */
export async function getMessageImageUrl(
  messageId: string
): Promise<{ url: string } | null> {
  if (!z.string().uuid().safeParse(messageId).success) return null;

  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();

  // RLS already restricts messages to participants, but confirm explicitly so a
  // non-participant gets a clean null rather than relying solely on the empty
  // result set.
  const { data: msg } = await supabase
    .from("messages")
    .select("image_path, conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg?.image_path) return null;

  const { data: conv } = await supabase
    .from("conversations")
    .select("client_id, photographer_id")
    .eq("id", msg.conversation_id)
    .maybeSingle();
  if (!conv || (conv.client_id !== user.id && conv.photographer_id !== user.id))
    return null;

  const { data: signed } = await supabase.storage
    .from(MESSAGE_IMAGE_BUCKET)
    .createSignedUrl(msg.image_path, MESSAGE_IMAGE_TTL);
  return signed?.signedUrl ? { url: signed.signedUrl } : null;
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
