"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ErrResult = { ok: false; error: string };

async function requireAdmin() {
  const profile = await getProfile();
  if (!profile?.is_admin) return null;
  return profile;
}

export async function updateReportStatus(
  reportId: string,
  status: "open" | "reviewed" | "dismissed"
): Promise<{ ok: true } | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/admin", "page");
  return { ok: true };
}
