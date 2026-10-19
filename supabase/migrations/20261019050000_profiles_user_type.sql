-- User role for marketplace positioning (self-declared on first signup)
alter table public.profiles
  add column if not exists user_type text;

alter table public.profiles
  drop constraint if exists profiles_user_type_check;

alter table public.profiles
  add constraint profiles_user_type_check
  check (
    user_type is null
    or user_type in ('lead_generator', 'drop_servicer', 'freelancer')
  );

comment on column public.profiles.user_type is
  'Self-declared: lead_generator | drop_servicer | freelancer. Set on first registration / onboarding.';
