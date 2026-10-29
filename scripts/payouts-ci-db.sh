#!/usr/bin/env bash
set -euo pipefail
export PGPASSWORD="${PGPASSWORD:-postgres}"
HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
DB="${PGDATABASE:-payout_test}"
USER="${PGUSER:-postgres}"

psql() { command psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" "$@"; }

echo "TESTED_SHA=$(git rev-parse HEAD)"
sha256sum supabase/migrations/20261021090000_payouts_atomic_reservations.sql
test -f supabase/migrations/20261021090000_payouts_atomic_reservations.sql
grep -q "'reversed'" supabase/migrations/20261021090000_payouts_atomic_reservations.sql
grep -q "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PARAMS" supabase/migrations/20261021090000_payouts_atomic_reservations.sql

psql -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;
create or replace function auth.role() returns text
language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$fn$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_price numeric not null,
  fulfillment_cost numeric not null,
  seller_profit numeric not null,
  payment_method text not null,
  payment_status text not null,
  payment_provider text,
  payment_transaction_id text,
  payment_confirmed_at timestamptz,
  spaceremit_payment_id text,
  status text not null,
  subscription_status text,
  current_billing_period integer not null default 1,
  next_billing_date date,
  freelancer_payout_status text,
  freelancer_payout_amount numeric,
  assigned_freelancer_id uuid,
  assignment_status text,
  operations_status text,
  delivered_at timestamptz,
  service_start_date date,
  service_end_date date
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  status text not null default 'PENDING',
  amount numeric not null default 0,
  currency text not null default 'USD',
  spaceremit_payment_id text,
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text,
  entity text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
alter table public.invoices enable row level security;
alter table public.audit_logs enable row level security;
alter table public.payout_requests enable row level security;
create policy "projects owners insert" on public.projects for insert to authenticated with check (true);
create policy "projects owners update" on public.projects for update to authenticated using (true) with check (true);
create policy "invoices owner write" on public.invoices for all to authenticated using (true) with check (true);
create policy "invoices owner status update" on public.invoices for update to authenticated using (true) with check (true);
create policy "users create own payouts" on public.payout_requests for insert to authenticated with check (true);
create policy "audit_logs api write" on public.audit_logs for insert to authenticated with check (true);

create table public.referrals (
  id uuid primary key,
  referrer_id uuid not null
);
create table public.referral_commissions (
  id uuid primary key,
  referral_id uuid not null references public.referrals(id),
  commission_amount numeric not null default 0 check (commission_amount >= 0),
  status text not null default 'pending'
    constraint referral_commissions_status_check
    check (status in ('pending','approved','available','paid','reversed','cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  available_at timestamptz
);

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending','approved','paid','cancelled')),
  method text check (method is null or method in ('paypal','local')),
  dropverse_fee numeric check (dropverse_fee is null or dropverse_fee >= 0),
  estimated_net numeric check (estimated_net is null or estimated_net >= 0),
  destination text,
  idempotency_key text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);

grant usage on schema public to anon, authenticated, service_role;
grant select,insert,update,delete on public.projects, public.invoices, public.audit_logs, public.payout_requests to authenticated;
grant all on public.projects, public.invoices, public.audit_logs, public.payout_requests to service_role;
SQL

psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261021090000_payouts_atomic_reservations.sql

psql -v ON_ERROR_STOP=1 -c "insert into public.referrals(id, referrer_id) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099');"
psql -v ON_ERROR_STOP=1 -c "insert into public.referral_commissions(id, referral_id, commission_amount, status) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001', 10, 'reversed');"

psql -v ON_ERROR_STOP=1 -c "select proname from pg_proc where proname in ('create_payout_request_atomic','get_payout_balance_summary');"

echo "Applying DropVerse security remediation migration"
SECURITY_MIGRATION="$(find supabase/migrations -maxdepth 1 -type f -name '*_security_remediation.sql' -print -quit)"
test -n "$SECURITY_MIGRATION"
psql -v ON_ERROR_STOP=1 -f "$SECURITY_MIGRATION"

# Server-only writes must be denied for authenticated clients.
if psql -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; INSERT INTO public.projects (user_id,client_price,fulfillment_cost,seller_profit,payment_method,payment_status,status) VALUES ('00000000-0000-0000-0000-000000000099',100,40,60,'SPACEREMIT','PAYMENT_PENDING','DRAFT');"; then
  echo "SECURITY_TEST_FAILED: authenticated project insert succeeded"; exit 1
fi
if psql -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; INSERT INTO public.invoices (user_id,amount,currency) VALUES ('00000000-0000-0000-0000-000000000099',40,'USD');"; then
  echo "SECURITY_TEST_FAILED: authenticated invoice insert succeeded"; exit 1
fi
if psql -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; INSERT INTO public.audit_logs (action,entity) VALUES ('forged','project');"; then
  echo "SECURITY_TEST_FAILED: authenticated audit insert succeeded"; exit 1
fi
if psql -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; INSERT INTO public.payout_requests (user_id,amount) VALUES ('00000000-0000-0000-0000-000000000099',10);"; then
  echo "SECURITY_TEST_FAILED: authenticated payout insert succeeded"; exit 1
fi

# Project state fields remain protected even where UPDATE privilege is retained.
psql -v ON_ERROR_STOP=1 -c "SET request.jwt.claim.role='service_role'; INSERT INTO public.projects (id,user_id,client_price,fulfillment_cost,seller_profit,payment_method,payment_status,status) VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099',100,40,60,'SPACEREMIT','PAYMENT_PENDING','DRAFT');"
if psql -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; UPDATE public.projects SET payment_status='PAYMENT_CONFIRMED' WHERE id='00000000-0000-0000-0000-000000000001';"; then
  echo "SECURITY_TEST_FAILED: authenticated payment-state update succeeded"; exit 1
fi

psql -v ON_ERROR_STOP=1 <<'SQL'
DO $test$
DECLARE first_claim boolean; replay_claim boolean; first_limit jsonb; second_limit jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  first_claim := public.claim_payment_transaction('SPACEREMIT','ci-payment-replay','project','00000000-0000-0000-0000-000000000001');
  replay_claim := public.claim_payment_transaction('SPACEREMIT','ci-payment-replay','invoice','00000000-0000-0000-0000-000000000002');
  IF NOT first_claim OR replay_claim THEN
    RAISE EXCEPTION 'SECURITY_TEST_FAILED: payment transaction replay was not blocked';
  END IF;
  first_limit := public.consume_rate_limit_bucket('ci-rate-limit',1,60000);
  second_limit := public.consume_rate_limit_bucket('ci-rate-limit',1,60000);
  IF first_limit->>'success' <> 'true' OR second_limit->>'success' <> 'false' THEN
    RAISE EXCEPTION 'SECURITY_TEST_FAILED: atomic rate limit did not enforce threshold';
  END IF;
END;
$test$;
SQL

echo "SECURITY_REMEDIATION_CI_DB_SMOKE_PASSED"
echo "PAYOUTS_CI_DB_SMOKE_PASSED"
