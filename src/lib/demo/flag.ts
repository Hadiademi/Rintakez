// Single switch for demo mode. When on, the Supabase client factories return an
// in-memory mock client instead of talking to a real backend. Must be a
// NEXT_PUBLIC_ var so both server and browser factories can read it.
export function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
