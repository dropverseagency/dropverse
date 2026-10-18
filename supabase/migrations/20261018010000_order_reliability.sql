-- Phase B: order events, email queue, tracking token, extended statuses
-- Safe additive migration. Code fails open if not applied yet.
-- APPLY ON A BRANCH / BACKUP FIRST.

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (
  status = any (array[
    'DRAFT'::text,
    'PAYMENT_PENDING'::text,
    'PAYMENT_CONFIRMED'::text,
    'READY_FOR_FULFILLMENT'::text,
    'ACTIVE'::text,
    'IN_PROGRESS'::text,
    'IN_REVIEW'::text,
    'DELIVERED'::text,
    'REVISION_REQUESTED'::text,
    'COMPLETED'::text,
    'CANCELLED'::text,
    'PAST_DUE'::text,
    'EXPIRED'::text,
    'PAYMENT_FAILED'::text
  ])
);

alter table public.projects
  add column if not exists tracking_token text,
  add column if not exists idempotency_key text,
  add column if not exists last_activity_at timestamptz,
  add column if not exists delivered_at timestamptz;

create unique index if not exists idx_projects_tracking_token
  on public.projects (tracking_token) where tracking_token is not null;
create unique index if not exists idx_projects_idempotency_key
  on public.projects (idempotency_key) where idempotency_key is not null;
create index if not exists idx_projects_status_activity
  on public.projects (status, last_activity_at);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('system','user','admin','webhook','cron')),
  from_status text,
  to_status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_order_events_idempotency
  on public.order_events (idempotency_key) where idempotency_key is not null;
create index if not exists idx_order_events_project_created
  on public.order_events (project_id, created_at desc);

alter table public.order_events enable row level security;

drop policy if exists "order_events admin read" on public.order_events;
create policy "order_events admin read" on public.order_events
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_email_queue_idempotency
  on public.email_queue (idempotency_key) where idempotency_key is not null;
create index if not exists idx_email_queue_pending
  on public.email_queue (status, next_attempt_at)
  where status in ('pending','failed');

alter table public.email_queue enable row level security;

drop policy if exists "email_queue admin read" on public.email_queue;
create policy "email_queue admin read" on public.email_queue
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create table if not exists public.ops_alert_dedupe (
  key text primary key,
  last_sent_at timestamptz not null default now()
);
alter table public.ops_alert_dedupe enable row level security;

comment on table public.order_events is 'Append-only order lifecycle events; written by service role only';
comment on table public.email_queue is 'Outbound email queue (Resend); service role writes, admin reads';
