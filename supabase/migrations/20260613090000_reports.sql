-- User reports for moderation. Any signed-in user can file a report; they can
-- see their own. Admin review happens through the service role (admin panel).

create type public.report_target as enum ('profile', 'shoot');
create type public.report_status as enum ('open', 'reviewed', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

grant select, insert on public.reports to authenticated;

create policy "reports_insert_own" on public.reports
  for insert with check (reporter_id = auth.uid());

create policy "reports_select_own" on public.reports
  for select using (reporter_id = auth.uid());
