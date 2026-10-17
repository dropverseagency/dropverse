-- Read-only checks + self-reverting tests for profiles.role protection.
-- Run in Supabase SQL Editor after applying 20261017090000_protect_profiles_role.sql
-- Use placeholders only — never paste real user data into committed files.

-- Query 1: detect non-user roles (possible past abuse or legitimate admins)
select p.id, p.role, u.email, p.created_at
from public.profiles p
left join auth.users u on u.id = p.id
where p.role is distinct from 'user'
order by p.created_at;

-- Query 2: triggers on public.profiles
select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal;

-- Query 3a: role escalation must fail for authenticated (self-reverting)
begin;
  set local role authenticated;
  -- Replace PLACEHOLDER_USER_ID with a real uuid only in the SQL editor, never commit it
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', 'PLACEHOLDER_USER_ID', 'role', 'authenticated')::text,
    true
  );
  -- Expected: exception `profiles.role cannot be changed by the user`
  update public.profiles
  set role = 'admin'
  where id = 'PLACEHOLDER_USER_ID'::uuid;
rollback;

-- Query 3b: harmless field update should succeed for the same user (self-reverting)
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', 'PLACEHOLDER_USER_ID', 'role', 'authenticated')::text,
    true
  );
  update public.profiles
  set full_name = coalesce(full_name, '') || ''
  where id = 'PLACEHOLDER_USER_ID'::uuid;
  -- Expected: success (0 or 1 row), no exception
rollback;
