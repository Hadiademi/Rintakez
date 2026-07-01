-- Harden shoot_invitations insert: it was the only content-creating insert
-- policy without a suspension/blocks guard, so a suspended client (or a client
-- involved in a block with the target photographer) could still push an
-- invite (and the notification/email it triggers). Recreate the policy with
-- the same suspension guard used by bids/shoots/messages/reviews/reports
-- (20260622010000_moderation.sql) and the same blocks guard used by messages
-- (20260622030000_blocks.sql), plus a direct check for the reverse block
-- direction (caller has blocked the target).

drop policy "shoot_invitations_insert_client" on public.shoot_invitations;
create policy "shoot_invitations_insert_client" on public.shoot_invitations
  for insert with check (
    client_id = auth.uid()
    and public.can_invite_to_shoot(shoot_id)
    and photographer_id <> auth.uid()
    and not public.is_suspended()
    and not public.blocked_by(photographer_id)
    and not exists (
      select 1 from public.user_blocks
      where blocker_id = auth.uid() and blocked_id = photographer_id
    )
    and exists (
      select 1 from public.profiles p
      where p.id = photographer_id and p.role = 'photographer'
    )
  );
