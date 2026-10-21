-- Payout safety hardening. Additive and scoped to referrals, commissions, and payout requests.
-- Apply this migration manually after reviewing the diff; it is not applied to any database by this commit.

begin;

-- The payout API and dashboard already use the "available" commission state.
-- Add the missing schema fields so the API's assumptions are explicit.
alter table public.referral_commissions
  add column if not exists currency text not null default 'USD',
  add column if not exists available_at timestamptz;

alter table public.referral_commissions
  drop constraint if exists referral_commissions_status_check;

alter table public.referral_commissions
  add constraint referral_commissions_status_check
  check (status in ('pending', 'approved', 'available', 'paid', 'cancelled'));

-- Persist the exact terms accepted when the request was made. Historical rows remain nullable.
alter table public.payout_requests
  add column if not exists method text,
  add column if not exists destination text,
  add column if not exists dropverse_fee numeric(12,2),
  add column if not exists estimated_net numeric(12,2),
  add column if not exists idempotency_key text;

alter table public.payout_requests
  drop constraint if exists payout_requests_method_check;
alter table public.payout_requests
  add constraint payout_requests_method_check
  check (method is null or method in ('paypal', 'local'));

alter table public.payout_requests
  drop constraint if exists payout_requests_dropverse_fee_check;
alter table public.payout_requests
  add constraint payout_requests_dropverse_fee_check
  check (dropverse_fee is null or dropverse_fee >= 0);

alter table public.payout_requests
  drop constraint if exists payout_requests_estimated_net_check;
alter table public.payout_requests
  add constraint payout_requests_estimated_net_check
  check (estimated_net is null or estimated_net >= 0);

create unique index if not exists payout_requests_user_idempotency_key_uidx
  on public.payout_requests (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payout_requests_user_open_status_idx
  on public.payout_requests (user_id, status)
  where status in ('pending', 'approved');

-- Service-role-only atomic reservation. The user-level transaction lock serializes
-- balance checks and inserts so concurrent requests cannot reserve the same funds twice.
create or replace function public.create_payout_request_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_method text,
  p_destination text,
  p_dropverse_fee numeric,
  p_estimated_net numeric,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.payout_requests%rowtype;
  v_available_commissions numeric(12,2);
  v_reserved numeric(12,2);
  v_available numeric(12,2);
  v_inserted public.payout_requests%rowtype;
begin
  if p_user_id is null
     or p_amount is null
     or p_amount <= 0
     or p_method not in ('paypal', 'local')
     or p_dropverse_fee is null
     or p_dropverse_fee < 0
     or p_estimated_net is null
     or p_estimated_net < 0
     or p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16
     or length(p_idempotency_key) > 128 then
    raise exception 'INVALID_PAYOUT_REQUEST' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select *
    into v_existing
    from public.payout_requests
   where user_id = p_user_id
     and idempotency_key = p_idempotency_key
   limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'request', jsonb_build_object(
        'id', v_existing.id,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'requested_at', v_existing.requested_at,
        'method', v_existing.method,
        'dropverse_fee', v_existing.dropverse_fee,
        'estimated_net', v_existing.estimated_net
      )
    );
  end if;

  select coalesce(sum(rc.commission_amount), 0)::numeric(12,2)
    into v_available_commissions
    from public.referral_commissions rc
    join public.referrals r on r.id = rc.referral_id
   where r.referrer_id = p_user_id
     and rc.status = 'available';

  select coalesce(sum(pr.amount), 0)::numeric(12,2)
    into v_reserved
    from public.payout_requests pr
   where pr.user_id = p_user_id
     and pr.status in ('pending', 'approved');

  v_available := greatest(0, round((v_available_commissions - v_reserved)::numeric, 2));

  if p_amount > v_available then
    return jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_BALANCE',
      'available', v_available
    );
  end if;

  insert into public.payout_requests (
    user_id, amount, status, method, destination,
    dropverse_fee, estimated_net, idempotency_key
  ) values (
    p_user_id, round(p_amount, 2), 'pending', p_method,
    nullif(left(trim(coalesce(p_destination, '')), 200), ''),
    round(p_dropverse_fee, 2), round(p_estimated_net, 2), p_idempotency_key
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'available', v_available - v_inserted.amount,
    'request', jsonb_build_object(
      'id', v_inserted.id,
      'amount', v_inserted.amount,
      'status', v_inserted.status,
      'requested_at', v_inserted.requested_at,
      'method', v_inserted.method,
      'dropverse_fee', v_inserted.dropverse_fee,
      'estimated_net', v_inserted.estimated_net
    )
  );
end;
$$;

revoke all on function public.create_payout_request_atomic(uuid, numeric, text, text, numeric, numeric, text) from public;
revoke all on function public.create_payout_request_atomic(uuid, numeric, text, text, numeric, numeric, text) from anon;
revoke all on function public.create_payout_request_atomic(uuid, numeric, text, text, numeric, numeric, text) from authenticated;
grant execute on function public.create_payout_request_atomic(uuid, numeric, text, text, numeric, numeric, text) to service_role;

-- Client access is read-only and limited to the authenticated user's own records.
-- Writes stay behind the server API/service-role function.
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;
alter table public.payout_requests enable row level security;

drop policy if exists "users read own referrals" on public.referrals;
create policy "users read own referrals" on public.referrals
  for select to authenticated using (referrer_id = auth.uid());

drop policy if exists "users read own referral commissions" on public.referral_commissions;
create policy "users read own referral commissions" on public.referral_commissions
  for select to authenticated using (
    exists (
      select 1 from public.referrals r
      where r.id = referral_commissions.referral_id
        and r.referrer_id = auth.uid()
    )
  );

drop policy if exists "users read own payout requests" on public.payout_requests;
create policy "users read own payout requests" on public.payout_requests
  for select to authenticated using (user_id = auth.uid());


-- Complete balance summary independent of the 100-row UI history limit.
create or replace function public.get_payout_balance_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  v_pending_commissions numeric(12,2);
  v_available_commissions numeric(12,2);
  v_paid_commissions numeric(12,2);
  v_non_usd_count bigint;
  v_open_payouts numeric(12,2);
  v_paid_payouts numeric(12,2);
begin
  if p_user_id is null then
    raise exception 'INVALID_USER_ID' using errcode = '22023';
  end if;

  select
    coalesce(sum(rc.commission_amount) filter (where rc.status in ('pending', 'approved')), 0)::numeric(12,2),
    coalesce(sum(rc.commission_amount) filter (where rc.status = 'available'), 0)::numeric(12,2),
    coalesce(sum(rc.commission_amount) filter (where rc.status = 'paid'), 0)::numeric(12,2),
    count(*) filter (where upper(coalesce(rc.currency, 'USD')) <> 'USD')
  into v_pending_commissions, v_available_commissions, v_paid_commissions, v_non_usd_count
  from public.referral_commissions rc
  join public.referrals r on r.id = rc.referral_id
  where r.referrer_id = p_user_id;

  if v_non_usd_count > 0 then
    raise exception 'NON_USD_COMMISSION_IN_USD_PAYOUT_LEDGER' using errcode = '22023';
  end if;

  select
    coalesce(sum(pr.amount) filter (where pr.status in ('pending', 'approved')), 0)::numeric(12,2),
    coalesce(sum(pr.amount) filter (where pr.status = 'paid'), 0)::numeric(12,2)
  into v_open_payouts, v_paid_payouts
  from public.payout_requests pr
  where pr.user_id = p_user_id;

  return jsonb_build_object(
    'pending', v_pending_commissions,
    'availableCommissions', v_available_commissions,
    'available', greatest(0, round((v_available_commissions - v_open_payouts)::numeric, 2)),
    'processing', v_open_payouts,
    'paidCommissions', v_paid_commissions,
    'totalPaidPayouts', v_paid_payouts
  );
end;
$$;

revoke all on function public.get_payout_balance_summary(uuid) from public;
revoke all on function public.get_payout_balance_summary(uuid) from anon;
revoke all on function public.get_payout_balance_summary(uuid) from authenticated;
grant execute on function public.get_payout_balance_summary(uuid) to service_role;

-- Restrictive policies keep any pre-existing permissive policy from widening
-- access to other users' financial records or enabling direct client writes.
drop policy if exists "users only read own referrals" on public.referrals;
create policy "users only read own referrals" on public.referrals
  as restrictive for select to anon, authenticated using (referrer_id = auth.uid());

drop policy if exists "users only read own referral commissions" on public.referral_commissions;
create policy "users only read own referral commissions" on public.referral_commissions
  as restrictive for select to anon, authenticated using (
    exists (
      select 1 from public.referrals r
      where r.id = referral_commissions.referral_id
        and r.referrer_id = auth.uid()
    )
  );

drop policy if exists "users only read own payout requests" on public.payout_requests;
create policy "users only read own payout requests" on public.payout_requests
  as restrictive for select to anon, authenticated using (user_id = auth.uid());

drop policy if exists "clients cannot insert payout requests directly" on public.payout_requests;
create policy "clients cannot insert payout requests directly" on public.payout_requests
  as restrictive for insert to anon, authenticated with check (false);
drop policy if exists "clients cannot update payout requests directly" on public.payout_requests;
create policy "clients cannot update payout requests directly" on public.payout_requests
  as restrictive for update to anon, authenticated using (false) with check (false);
drop policy if exists "clients cannot delete payout requests directly" on public.payout_requests;
create policy "clients cannot delete payout requests directly" on public.payout_requests
  as restrictive for delete to anon, authenticated using (false);

drop policy if exists "clients cannot insert referral commissions directly" on public.referral_commissions;
create policy "clients cannot insert referral commissions directly" on public.referral_commissions
  as restrictive for insert to anon, authenticated with check (false);
drop policy if exists "clients cannot update referral commissions directly" on public.referral_commissions;
create policy "clients cannot update referral commissions directly" on public.referral_commissions
  as restrictive for update to anon, authenticated using (false) with check (false);
drop policy if exists "clients cannot delete referral commissions directly" on public.referral_commissions;
create policy "clients cannot delete referral commissions directly" on public.referral_commissions
  as restrictive for delete to anon, authenticated using (false);

commit;
