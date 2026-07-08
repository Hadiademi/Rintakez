// Pure predicate mirroring the WHERE clause in
// public.notify_matching_photographers() (see
// supabase/migrations/20260701060000_shoot_match_notification.sql and
// 20260708000000_shoot_match_alert_gating.sql): a photographer matches a
// shoot when their coverage includes the shoot's canton, their disciplines
// include the shoot's discipline, and they didn't post the shoot themselves.
// Extracted so scanShootMatchDigest (src/lib/lifecycle.ts) can reuse the same
// match logic in TypeScript for the basic-tier digest, instead of
// re-implementing it ad hoc against the candidate arrays fetched from
// Supabase. notify_shoot_updates / is_suspended are NOT part of this
// predicate — those are separately enforced via filterByNotifyShootUpdates /
// suspendedIds, mirroring how the SQL trigger applies them as additional
// WHERE clauses alongside (not inside) the coverage/discipline match.
export function photographerMatchesShoot(
  shoot: { canton: string; discipline: string; client_id: string },
  photographer: {
    profile_id: string;
    coverage_cantons: string[];
    disciplines: string[];
  }
): boolean {
  return (
    photographer.coverage_cantons.includes(shoot.canton) &&
    photographer.disciplines.includes(shoot.discipline) &&
    shoot.client_id !== photographer.profile_id
  );
}
