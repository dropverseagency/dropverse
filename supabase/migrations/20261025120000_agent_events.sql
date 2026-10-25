-- Optional idempotency table for Agent A. Apply manually after review.
-- Does NOT change sample/payout behavior.

begin;

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  agent text not null,
  entity_id uuid null,
  created_at timestamptz not null default now(),
  constraint agent_events_idempotency_key_unique unique (idempotency_key)
);

create index if not exists agent_events_agent_created_idx
  on public.agent_events (agent, created_at desc);

alter table public.agent_events enable row level security;

-- No anon/authenticated policies: service role only.
revoke all on public.agent_events from anon, authenticated;
grant select, insert on public.agent_events to service_role;

commit;
