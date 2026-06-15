"use server";

import { revalidatePath } from "next/cache";
import { isDemo } from "@/lib/demo/flag";
import { reseed } from "@/lib/demo/store";

// Restores the demo store to its original fixtures, discarding any in-session
// writes. No-op outside demo mode.
export async function resetDemoAction(): Promise<void> {
  if (!isDemo()) return;
  reseed();
  revalidatePath("/", "layout");
}
