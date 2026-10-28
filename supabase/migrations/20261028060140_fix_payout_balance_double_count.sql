-- Prevent paid affiliate withdrawals from reappearing as available balance.
-- Project fulfillment earnings remain on their separate admin-release workflow.

begin;

create or replace function public.get_payout_balance_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending_commissions numeric(12,2);
  v_available_commissions numeric(12,2);
  v_paid_commissions numeric(12,2);
  v_pending_projects numeric(12,2);
  v_available_projects numeric(12,2);
  v_paid_projects numeric(12,2);
  v_non_usd_count bigint;
  v_open_payouts numeric(12,2);
  v_paid_payouts numeric(12,2);
  v_available_total numeric(12,2);
begin
  if p_user_id is null then
    raise exception 'INVALID_USER_ID' using errcode = '22023';
  end if;

  select
    coalesce(sum(rc.commission_amount) filter (where rc.status in ('pending','approved')),0),
    coalesce(sum(rc.commission_amount) filter (where rc.status='available'),0),
    coalesce(sum(rc.commission_amount) filter (where rc.status='paid'),0),
    count(*) filter (where upper(coalesce(rc.currency,'USD')) <> 'USD')
  into v_pending_commissions, v_available_commissions, v_paid_commissions, v_non_usd_count
  from public.referral_commissions rc
  join public.referrals r on r.id = rc.referral_id
  where r.referrer_id = p_user_id;

  if v_non_usd_count > 0 then
    raise exception 'NON_USD_COMMISSION_IN_USD_PAYOUT_LEDGER' using errcode = '22023';
  end if;

  select
    coalesce(sum(amount) filter (where status='held'),0),
    coalesce(sum(amount) filter (where status='releasable'),0),
    coalesce(sum(amount) filter (where status='released'),0)
  into v_pending_projects, v_available_projects, v_paid_projects
  from public.project_earnings
  where freelancer_id = p_user_id;

  select
    coalesce(sum(amount) filter (where status in ('pending','approved')),0),
    coalesce(sum(amount) filter (where status='paid'),0)
  into v_open_payouts, v_paid_payouts
  from public.payout_requests
  where user_id = p_user_id;

  -- Paid payout requests permanently consume their reserved commission balance.
  -- Pending/approved requests remain reserved until paid or cancelled.
  v_available_total := greatest(
    0,
    round((v_available_commissions - v_open_payouts - v_paid_payouts)::numeric, 2)
  );

  return jsonb_build_object(
    'pending', v_pending_commissions + v_pending_projects,
    'pendingCommissions', v_pending_commissions,
    'pendingProjectEarnings', v_pending_projects,
    'availableCommissionsGross', v_available_commissions,
    'availableCommissions', v_available_total,
    'releasableProjectEarnings', v_available_projects,
    'releasedProjectEarnings', v_paid_projects,
    'available', v_available_total,
    'processing', v_open_payouts,
    'paidCommissions', v_paid_commissions,
    'totalPaidPayouts', v_paid_payouts
  );
end;
$$;

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
  v_paid_payouts numeric(12,2);
  v_available numeric(12,2);
  v_inserted public.payout_requests%rowtype;
begin
  if p_user_id is null
     or p_amount is null
     or p_amount <= 0
     or p_method is null
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
    if round(v_existing.amount, 2) is distinct from round(p_amount, 2)
       or coalesce(v_existing.method, '') is distinct from coalesce(p_method, '')
       or round(coalesce(v_existing.dropverse_fee, -1), 2) is distinct from round(p_dropverse_fee, 2)
       or round(coalesce(v_existing.estimated_net, -1), 2) is distinct from round(p_estimated_net, 2)
       or coalesce(v_existing.destination, '') is distinct from
          coalesce(nullif(left(trim(coalesce(p_destination, '')), 200), ''), '') then
      return jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PARAMS',
        'request', jsonb_build_object(
          'id', v_existing.id,
          'amount', v_existing.amount,
          'status', v_existing.status,
          'method', v_existing.method
        )
      );
    end if;
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

  select coalesce(sum(pr.amount), 0)::numeric(12,2)
    into v_paid_payouts
    from public.payout_requests pr
   where pr.user_id = p_user_id
     and pr.status = 'paid';

  v_available := greatest(0, round((v_available_commissions - v_reserved - v_paid_payouts)::numeric, 2));

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

commit;
