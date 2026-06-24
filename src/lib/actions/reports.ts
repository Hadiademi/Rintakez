"use server";

import { dbError } from "@/lib/action-error";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

type ErrResult = { ok: false; error: string };

const reportSchema = z.object({
  targetType: z.enum(["profile", "shoot"]),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

export async function submitReport(
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await rateLimit(`report:${user.id}`, 10, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason.trim(),
  });
  if (error) return { ok: false, error: dbError(error, "reports") };

  return { ok: true };
}
