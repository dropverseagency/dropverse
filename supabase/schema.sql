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
  );
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

create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);
create policy "public active categories" on public.categories for select using (active = true);
create policy "public active services" on public.services for select using (active = true);
create policy "public active freelancers" on public.freelancers for select using (active = true);
create policy "public work samples" on public.work_samples for select using (true);
create policy "users read own saves" on public.saved_samples for select using (auth.uid() = user_id);
create policy "users create own saves" on public.saved_samples for insert with check (auth.uid() = user_id);
create policy "users delete own saves" on public.saved_samples for delete using (auth.uid() = user_id);

-- Admin write policies: only users whose profile role = 'admin' can manage content.
create policy "admins manage categories" on public.categories for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "admins manage services" on public.services for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "admins manage freelancers" on public.freelancers for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "admins manage work samples" on public.work_samples for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "users update own profile" on public.profiles for update using (
  auth.uid() = id and (select role from public.profiles where id = auth.uid()) = 'user') with check (
  auth.uid() = id);

-- Indexes for common lookups
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_saved_samples_user on public.saved_samples(user_id);
create index if not exists idx_work_samples_featured on public.work_samples(featured) where featured = true;
create index if not exists idx_services_category on public.services(category_id) where active = true;

-- ============================================================
-- DropVerse Partner Program — referral & commission schema
-- All commission calculations happen server-side (database
-- functions), never trusted from the frontend.
-- ============================================================

create table if not exists public.program_config (
  id integer primary key default 1,
  -- Global program settings an admin can update later
  referral_eligibility_months integer not null default 12,
  referral_kind text[] not null default '{user,client}',
  terms_version text not null default '1',
  updated_at timestamptz not null default now()
);

insert into public.program_config (id)
select 1 where not exists (select 1 from public.program_config where id = 1);

-- Tier thresholds are stored in the config table so admins can reprice later.
-- commission_rate is stored as a fraction (e.g. 0.10 = 10%).
create table if not exists public.referral_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_active_referrals integer not null,
  max_active_referrals integer, -- null means unlimited
  commission_rate numeric not null check (commission_rate > 0 and commission_rate <= 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.referral_tiers (name, min_active_referrals, max_active_referrals, commission_rate)
select v[1]::text, v[2]::int, v[3]::int, v[4]::numeric
from (values
  ('STARTER', 1, 5, 0.10),
  ('GROWTH', 6, 20, 0.15),
  ('PRO', 21, 50, 0.20),
  ('PARTNER', 51, null, 0.25)
) as v
where not exists (select 1 from public.referral_tiers where name = v[1]);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique, -- e.g. ABD123, used in /r/CODE
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
  expires_at timestamptz not null, -- 12-month eligibility window
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  -- Original source tracking for attribution
  source_url text,
  source_channel text,
  unique(referred_user_id) where referred_user_id is not null
);

-- Client referrals don't attach to a user account yet; the project tracks them.
-- eligible_project_id is set server-side once the underlying activity qualifies.
create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  project_id uuid, -- resolved server-side to the eligible project/activity
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
  event text not null, -- e.g. commission_approved, commission_paid, payout_requested, payout_completed
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

-- Server-side commission creation: only this function creates commissions,
-- so amounts can never be spoofed from the frontend.
create or replace function public.create_referral_commission(
  p_referral_id uuid,
  p_project_id uuid,
  p_eligible_profit numeric,
  p_commission_rate numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_referral record; v_commission_id uuid; v_amount numeric;
begin
  select * into v_referral from public.referrals where id = p_referral_id;
  if not found then raise exception 'referral not found'; end if;
  if v_referral.status <> 'active' then raise exception 'referral is not active'; end if;
  if v_referral.expires_at < now() then raise exception 'referral eligibility has expired'; end if;
  if p_eligible_profit < 0 or p_commission_rate <= 0 or p_commission_rate > 1 then
    raise exception 'invalid commission parameters';
  end if;
  -- Prevent self-referrals
  if v_referral.referrer_id = p_referral_id then raise exception 'self-referral not allowed'; end if;
  -- Prevent double-commissioning the same project
  if exists (select 1 from public.referral_commissions c
             where c.referral_id = p_referral_id and c.project_id = p_project_id
             and c.status <> 'cancelled') then
    raise exception 'commission already exists for this project';
  end if;
  v_amount := floor(p_eligible_profit * p_commission_rate * 100) / 100;
  insert into public.referral_commissions
    (referral_id, project_id, eligible_profit, commission_rate, commission_amount, status)
  values (p_referral_id, p_project_id, p_eligible_profit, p_commission_rate, v_amount, 'pending')
  returning id into v_commission_id;
  return v_commission_id;
end; $$;

-- Resolve the active tier for a referrer (tier of referrer's active referral count).
create or replace function public.active_referral_tier(p_user_id uuid) returns numeric language plpgsql security definer set search_path = public as $$
declare v_count integer; v_rate numeric;
begin
  select count(*) into v_count from public.referrals
  where referrer_id = p_user_id and status = 'active' and expires_at > now();
  select t.commission_rate into v_rate from public.referral_tiers t
  where t.active = true and v_count >= t.min_active_referrals
  order by t.min_active_referrals desc limit 1;
  return coalesce(v_rate, 0);
end; $$;

-- RLS
alter table public.program_config enable row level security;
alter table public.referral_tiers enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.payout_requests enable row level security;

create policy "config public read" on public.program_config for select using (true);
create policy "admins update config" on public.program_config for update using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "tiers public read" on public.referral_tiers for select using (true);
create policy "admins manage tiers" on public.referral_tiers for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "users read own codes" on public.referral_codes for select using (auth.uid() = user_id);
create policy "users create own codes" on public.referral_codes for insert with check (auth.uid() = user_id);
create policy "users update own codes" on public.referral_codes for update using (auth.uid() = user_id);
create policy "users read own referrals" on public.referrals for select using (auth.uid() = referrer_id);
create policy "users read own commissions" on public.referral_commissions for select using (
  auth.uid() = (select referrer_id from public.referrals where id = referral_commissions.referral_id));
create policy "users read own ledger" on public.commission_ledger for select using (auth.uid() = user_id);
create policy "users read own payouts" on public.payout_requests for select using (auth.uid() = user_id);
create policy "users create own payouts" on public.payout_requests for insert with check (auth.uid() = user_id);
create policy "admins read all referrals" on public.referrals for select using (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "admins manage commissions" on public.referral_commissions for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');
create policy "admins manage payouts" on public.payout_requests for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin') with check (
  (select role from public.profiles where id = auth.uid()) = 'admin');

-- Indexes
create index if not exists idx_referrals_referrer on public.referrals(referrer_id);
create index if not exists idx_referrals_status on public.referrals(status) where status = 'active';
create index if not exists idx_referrals_referred_user on public.referrals(referred_user_id);
create index if not exists idx_referral_codes_code on public.referral_codes(code) where active = true;
create index if not exists idx_referral_commissions_referral on public.referral_commissions(referral_id);
create index if not exists idx_referral_commissions_status on public.referral_commissions(status) where status = 'pending';
create index if not exists idx_commission_ledger_user on public.commission_ledger(user_id);
create index if not exists idx_payout_requests_user on public.payout_requests(user_id);
