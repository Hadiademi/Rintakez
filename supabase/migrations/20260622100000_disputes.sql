-- Dispute resolution: a participant of a booked shoot (client or assigned
-- photographer) can raise a dispute; admins review and resolve. Builds trust and
-- gives a structured path for "didn't show up" / "not as agreed" cases.

create type public.dispute_status as enum ('open', 'resolved', 'dismissed');

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 2000),
  status public.dispute_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index disputes_status_idx on public.disputes (status, created_at desc);
create index disputes_shoot_idx on public.disputes (shoot_id);

alter table public.disputes enable row level security;

grant select, insert on public.disputes to authenticated;

-- A participant may open a dispute on their own assigned/completed shoot (and not
-- while suspended). Resolution is admin-only via the service role.
create policy "disputes_insert_participant" on public.disputes
  for insert with check (
    opened_by = auth.uid()
    and not public.is_suspended()
    and (
      public.is_shoot_client(shoot_id)
      or public.is_accepted_photographer(shoot_id)
    )
    and exists (
      select 1 from public.shoots s
      where s.id = shoot_id and s.status in ('assigned', 'completed')
    )
  );

-- Participants can see disputes on shoots they belong to.
create policy "disputes_select_participant" on public.disputes
  for select using (
    public.is_shoot_client(shoot_id)
    or public.is_accepted_photographer(shoot_id)
  );
