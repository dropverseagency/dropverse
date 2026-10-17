-- URGENT: close privilege-escalation on public.profiles
-- Policies combine with OR — the old "profiles own update" allowed any column change including role.
-- Apply on production AFTER a backup. This file is NOT applied by the app automatically.

-- 1) one update policy; the trigger below is the hard guard for role
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
create policy "profiles own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2) insert policy forces role = 'user'
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles
  for insert with check (auth.uid() = id and role = 'user');

-- 3) hard guard: only service_role / SQL editor can change role
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
