-- Allow multiple self-declared roles per user
alter table public.profiles
  add column if not exists user_types text[] default '{}';

-- Drop single-value check if present
alter table public.profiles
  drop constraint if exists profiles_user_type_check;

-- Keep user_type as optional primary label (first selected)
alter table public.profiles
  add constraint profiles_user_type_check
  check (
    user_type is null
    or user_type in ('lead_generator', 'drop_servicer', 'freelancer')
  );

-- Validate array elements
alter table public.profiles
  drop constraint if exists profiles_user_types_check;

alter table public.profiles
  add constraint profiles_user_types_check
  check (
    user_types is null
    or user_types <@ array['lead_generator', 'drop_servicer', 'freelancer']::text[]
  );

-- Backfill from existing single user_type
update public.profiles
set user_types = array[user_type]
where user_type is not null
  and (user_types is null or cardinality(user_types) = 0);

comment on column public.profiles.user_types is
  'Self-declared roles (multi): lead_generator, drop_servicer, freelancer';
