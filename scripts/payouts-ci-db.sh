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
grant select on public.payout_requests to authenticated;
grant all on public.payout_requests to service_role;
SQL

psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261021090000_payouts_atomic_reservations.sql

psql -v ON_ERROR_STOP=1 -c "insert into public.referrals(id, referrer_id) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099');"
psql -v ON_ERROR_STOP=1 -c "insert into public.referral_commissions(id, referral_id, commission_amount, status) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001', 10, 'reversed');"

psql -v ON_ERROR_STOP=1 -c "select proname from pg_proc where proname in ('create_payout_request_atomic','get_payout_balance_summary');"

echo "PAYOUTS_CI_DB_SMOKE_PASSED"
