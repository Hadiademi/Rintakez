-- Rintakez schema. Spec §3. RLS policies live in the next migration.

create type public.user_role as enum ('client', 'photographer');
create type public.locale as enum ('de', 'fr', 'en');
create type public.canton as enum (
  'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE',
  'NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'
);
create type public.shoot_type as enum (
  'wedding','portrait','commercial','event','architecture','family','other'
);
create type public.shoot_status as enum ('open','assigned','completed','cancelled');
create type public.bid_status as enum ('pending','accepted','declined','withdrawn');

-- ── profiles ────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text not null,
  avatar_url text,
  city text,
  canton public.canton,
  locale public.locale not null default 'de',
  bio text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup; role/name/locale come from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, locale)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'locale')::public.locale, 'de')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── photographer_details ────────────────────────────────────────────
create table public.photographer_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  specialties public.shoot_type[] not null default '{}',
  coverage_cantons public.canton[] not null default '{}',
  hourly_rate_chf integer check (hourly_rate_chf > 0),
  website_url text,
  instagram_url text,
  created_at timestamptz not null default now()
);

-- ── portfolio_images ────────────────────────────────────────────────
create table public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index portfolio_images_photographer_idx
  on public.portfolio_images (photographer_id);

-- Hard cap: 20 portfolio images per photographer.
create or replace function public.enforce_portfolio_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.portfolio_images
      where photographer_id = new.photographer_id) >= 20 then
    raise exception 'portfolio limit reached (20 images)';
  end if;
  return new;
end;
$$;

create trigger portfolio_limit
  before insert on public.portfolio_images
  for each row execute function public.enforce_portfolio_limit();

-- ── shoots ──────────────────────────────────────────────────────────
create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  type public.shoot_type not null,
  brief text not null check (char_length(brief) between 10 and 4000),
  location_city text not null,
  location_postcode text check (location_postcode ~ '^[0-9]{4}$'),
  canton public.canton not null,
  shoot_date date not null,
  duration_hours integer not null check (duration_hours between 1 and 24),
  budget_min_chf integer not null check (budget_min_chf > 0),
  budget_max_chf integer not null,
  status public.shoot_status not null default 'open',
  accepted_bid_id uuid, -- FK added after bids exists
  created_at timestamptz not null default now(),
  constraint budget_range check (budget_max_chf >= budget_min_chf)
);

create index shoots_browse_idx on public.shoots (status, canton, shoot_date);
create index shoots_client_idx on public.shoots (client_id);

-- ── bids ────────────────────────────────────────────────────────────
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  amount_chf integer not null check (amount_chf > 0),
  message text not null check (char_length(message) between 10 and 2000),
  status public.bid_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint one_bid_per_photographer unique (shoot_id, photographer_id)
);

create index bids_shoot_idx on public.bids (shoot_id);
create index bids_photographer_idx on public.bids (photographer_id);

alter table public.shoots
  add constraint shoots_accepted_bid_fk
  foreign key (accepted_bid_id) references public.bids (id);
