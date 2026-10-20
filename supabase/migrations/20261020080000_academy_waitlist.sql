-- Academy Advanced path interest list (notify when paid track opens)
create table if not exists public.academy_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  source text not null default 'academy_advanced',
  created_at timestamptz not null default now(),
  constraint academy_waitlist_email_check check (char_length(email) between 3 and 320),
  constraint academy_waitlist_email_source_unique unique (email, source)
);

create index if not exists academy_waitlist_created_at_idx
  on public.academy_waitlist (created_at desc);

alter table public.academy_waitlist enable row level security;

-- No direct client policies: inserts/reads go through service role API routes only.

comment on table public.academy_waitlist is
  'Emails interested in Advanced Academy (paid path). Used to notify when enrollment opens.';
