import { captureError } from "@/lib/observability";

/**
 * Convert a Supabase/Postgres error into a safe, stable client code. The raw
 * error carries internals — Postgres SQLSTATEs, table/constraint names, row
 * detail — that must never travel to the browser, so it is logged server-side
 * and the caller returns only "generic". The UI maps that via `errorKey()` like
 * any other code. `scope` tags the log so the origin is identifiable even though
 * Supabase errors are plain objects without a stack.
 */
export function dbError(error: unknown, scope: string): "generic" {
  captureError(error, { scope });
  return "generic";
}
