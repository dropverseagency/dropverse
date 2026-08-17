create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
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
begin insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;

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
