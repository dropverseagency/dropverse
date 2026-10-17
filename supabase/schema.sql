create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text not null,
  telegram_username text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
  description text, active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id) on delete set null,
  title text not null, slug text unique not null, description text not null default '', active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.freelancers (
  id uuid primary key default gen_random_uuid(), name text not null, avatar_url text, bio text,
  specialty text, skills text[] not null default '{}', tools text[] not null default '{}',
  starting_price numeric, delivery_time text, active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists public.work_samples (
  id uuid primary key default gen_random_uuid(), freelancer_id uuid references public.freelancers(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null, title text not null, description text not null default '',
  media_url text, thumbnail_url text, tools text[] not null default '{}', price numeric, delivery_time text,
  featured boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists public.saved_samples (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  sample_id uuid not null references public.work_samples(id) on delete cascade, created_at timestamptz not null default now(),
  unique(user_id, sample_id)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, telegram_username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'telegram_username','')
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    telegram_username = coalesce(excluded.telegram_username, public.profiles.telegram_username);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.freelancers enable row level security;
alter table public.work_samples enable row level security;
alter table public.saved_samples enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
create policy "profiles own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles
  for insert with check (auth.uid() = id and role = 'user');
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'profiles.role cannot be changed by the user';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();
drop policy if exists "public active categories" on public.categories;
create policy "public active categories" on public.categories for select using (active = true);
drop policy if exists "public active services" on public.services;
create policy "public active services" on public.services for select using (active = true);
drop policy if exists "public active freelancers" on public.freelancers;
create policy "public active freelancers" on public.freelancers for select using (active = true);
drop policy if exists "public work samples" on public.work_samples;
create policy "public work samples" on public.work_samples for select using (true);
drop policy if exists "users read own saves" on public.saved_samples;
create policy "users read own saves" on public.saved_samples for select using (auth.uid() = user_id);
drop policy if exists "users create own saves" on public.saved_samples;
create policy "users create own saves" on public.saved_samples for insert with check (auth.uid() = user_id);
drop policy if exists "users delete own saves" on public.saved_samples;
create policy "users delete own saves" on public.saved_samples for delete using (auth.uid() = user_id);

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
drop policy if exists "admins manage services" on public.services;
create policy "admins manage services" on public.services for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
drop policy if exists "admins manage freelancers" on public.freelancers;
create policy "admins manage freelancers" on public.freelancers for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
drop policy if exists "admins manage work samples" on public.work_samples;
create policy "admins manage work samples" on public.work_samples for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_saved_samples_user on public.saved_samples(user_id);
create index if not exists idx_work_samples_featured on public.work_samples(featured) where featured = true;
create index if not exists idx_services_category on public.services(category_id) where active = true;

-- Partner program tables: restored from main (production already has these).
-- Full definitions: see git history of this file on main if re-bootstrapping a new DB.
create table if not exists public.program_config (
  id integer primary key default 1,
  referral_eligibility_months integer not null default 12,
  referral_kind text[] not null default '{user,client}',
  terms_version text not null default '1',
  updated_at timestamptz not null default now()
);
create table if not exists public.referral_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_active_referrals integer not null,
  max_active_referrals integer,
  commission_rate numeric not null check (commission_rate > 0 and commission_rate <= 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  kind text not null default 'user' check (kind in ('user','client')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'user' check (kind in ('user','client')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  source_url text,
  source_channel text
);
create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  project_id uuid,
  eligible_profit numeric not null default 0 check (eligible_profit >= 0),
  commission_rate numeric not null check (commission_rate > 0 and commission_rate <= 1),
  commission_amount numeric not null default 0 check (commission_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);
create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commission_id uuid references public.referral_commissions(id) on delete set null,
  event text not null,
  amount numeric not null default 0,
  balance_after numeric,
  created_at timestamptz not null default now()
);
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null default 0 check (amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);
