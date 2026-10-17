-- ============================================================
-- COPY-PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- After: Dashboard backup / point-in-time recovery awareness
-- Expected: success, no rows returned (or CREATE notices)
-- ============================================================

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

-- Verify
select policyname, cmd, with_check
from pg_policies
where tablename = 'profiles'
order by policyname;

select tgname from pg_trigger
where tgrelid = 'public.profiles'::regclass and not tgisinternal;
