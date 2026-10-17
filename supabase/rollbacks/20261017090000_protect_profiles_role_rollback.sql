-- Rollback of 20261017090000_protect_profiles_role.sql
-- Restores the PREVIOUS (insecure) live policies. Prefer re-applying the secure migration instead.

drop trigger if exists protect_profile_role on public.profiles;
drop function if exists public.protect_profile_role();

drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;

-- Previous live policies (do not use unless you intentionally reopen the hole)
create policy "profiles own update" on public.profiles
  for update using (auth.uid() = id);

create policy "users update own profile" on public.profiles
  for update using (
    auth.uid() = id and (select role from public.profiles where id = auth.uid()) = 'user'
  ) with check (auth.uid() = id);

create policy "profiles own insert" on public.profiles
  for insert with check (auth.uid() = id);

-- "profiles own read" was never dropped by the forward migration
