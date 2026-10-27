-- Project operations v1: assignment, delivery, revisions, disputes and audit history.
-- Additive only. Money release remains an explicit, idempotent admin operation.

alter table public.projects
  add column if not exists assigned_freelancer_id uuid references auth.users(id) on delete set null,
  add column if not exists assignment_status text not null default 'unassigned'
    check (assignment_status in ('unassigned','offered','accepted','declined','reassigned')),
  add column if not exists delivery_due_at timestamptz,
  add column if not exists operations_status text not null default 'awaiting_payment'
    check (operations_status in ('awaiting_payment','ready_to_assign','assigned','in_progress','delivered','revision_requested','approved','disputed','refunded','cancelled')),
  add column if not exists freelancer_payout_status text not null default 'not_earned'
    check (freelancer_payout_status in ('not_earned','held','releasable','released','reversed')),
  add column if not exists freelancer_payout_amount numeric(12,2)
    check (freelancer_payout_amount is null or freelancer_payout_amount >= 0);

create index if not exists projects_assigned_freelancer_idx
  on public.projects (assigned_freelancer_id, operations_status);

create table if not exists public.freelancer_availability (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available boolean not null default true,
  capacity integer not null default 1 check (capacity between 0 and 50),
  next_available_at timestamptz,
  typical_turnaround_days integer check (typical_turnaround_days between 1 and 90),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  freelancer_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','reassigned','cancelled')),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  response_note text check (char_length(response_note) <= 1000)
);
create unique index if not exists project_assignments_one_open_idx
  on public.project_assignments(project_id) where status in ('offered','accepted');

create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('seller','freelancer','client','admin','system')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists project_messages_project_idx on public.project_messages(project_id, created_at);

create table if not exists public.project_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null check (version > 0),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  unique(project_id, version)
);

create table if not exists public.project_revision_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  delivery_id uuid references public.project_deliveries(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  request_number integer not null check (request_number > 0),
  details text not null check (char_length(trim(details)) between 1 and 3000),
  included boolean not null,
  price_usd numeric(12,2) not null default 0 check (price_usd >= 0),
  payment_status text not null default 'not_required' check (payment_status in ('not_required','pending','paid','waived','refunded')),
  status text not null default 'open' check (status in ('open','in_progress','delivered','closed','cancelled')),
  created_at timestamptz not null default now(),
  unique(project_id, request_number)
);

create table if not exists public.project_disputes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 10 and 3000),
  status text not null default 'open' check (status in ('open','under_review','resolved','refunded','rejected')),
  resolution text check (char_length(resolution) <= 3000),
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('seller','freelancer','client','admin','system')),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists project_events_project_idx on public.project_events(project_id, created_at desc);

create table if not exists public.project_client_tokens (
  project_id uuid primary key references public.projects(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_earnings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  freelancer_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'held' check (status in ('held','releasable','released','reversed')),
  released_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.freelancer_availability enable row level security;
alter table public.project_assignments enable row level security;
alter table public.project_messages enable row level security;
alter table public.project_deliveries enable row level security;
alter table public.project_revision_requests enable row level security;
alter table public.project_disputes enable row level security;
alter table public.project_events enable row level security;
alter table public.project_client_tokens enable row level security;
alter table public.project_earnings enable row level security;

create policy "freelancer manages own availability" on public.freelancer_availability
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "participants read assignments" on public.project_assignments for select using (
  freelancer_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
);
create policy "participants read messages" on public.project_messages for select using (
  author_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and (p.user_id = auth.uid() or p.assigned_freelancer_id = auth.uid()))
);
create policy "participants read deliveries" on public.project_deliveries for select using (
  exists (select 1 from public.projects p where p.id = project_id and (p.user_id = auth.uid() or p.assigned_freelancer_id = auth.uid()))
);
create policy "participants read revisions" on public.project_revision_requests for select using (
  exists (select 1 from public.projects p where p.id = project_id and (p.user_id = auth.uid() or p.assigned_freelancer_id = auth.uid()))
);
create policy "participants read disputes" on public.project_disputes for select using (
  exists (select 1 from public.projects p where p.id = project_id and (p.user_id = auth.uid() or p.assigned_freelancer_id = auth.uid()))
);
create policy "participants read events" on public.project_events for select using (
  exists (select 1 from public.projects p where p.id = project_id and (p.user_id = auth.uid() or p.assigned_freelancer_id = auth.uid()))
);
create policy "freelancer reads own earnings" on public.project_earnings for select using (freelancer_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-deliveries', 'project-deliveries', false, 104857600)
on conflict (id) do nothing;
