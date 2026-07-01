import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/action-error";

export type InviteResult = { ok: true } | { ok: false; error: string };

export type InvitePhotographerInput = {
  photographerId: string;
  shootId: string;
  clientId: string;
};

/**
 * Inserts a shoot invitation. Framework-agnostic: the caller supplies an
 * authenticated Supabase client and the resolved client (inviter) id, so the
 * same function serves the web action today and a native client later. RLS
 * enforces ownership/role; the DB trigger creates the photographer's
 * notification.
 */
export async function invitePhotographer(
  supabase: SupabaseClient,
  input: InvitePhotographerInput
): Promise<InviteResult> {
  const { error } = await supabase.from("shoot_invitations").insert({
    shoot_id: input.shootId,
    photographer_id: input.photographerId,
    client_id: input.clientId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_invited" };
    return { ok: false, error: dbError(error, "shoot_invitations") };
  }
  return { ok: true };
}
