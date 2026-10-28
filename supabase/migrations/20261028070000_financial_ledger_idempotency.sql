-- Financial ledger idempotency hardening.
-- Prevent duplicate referral commissions per project/referral and make project
-- earning release + project status transition atomic and retry-safe.

begin;

create unique index if not exists referral_commissions_project_referral_uidx
  on public.referral_commissions (project_id, referral_id)
  where project_id is not null and referral_id is not null;

create or replace function public.release_project_earning_atomic(
  p_project_id uuid,
  p_admin_user_id uuid,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project record;
  v_earning record;
  v_now timestamptz := pg_catalog.now();
begin
  if p_project_id is null
     or p_admin_user_id is null
     or p_reference is null
     or pg_catalog.length(pg_catalog.btrim(p_reference)) = 0
     or pg_catalog.length(p_reference) > 200 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  -- Lock the project first so concurrent admins serialize on the same release.
  select p.id, p.title, p.assigned_freelancer_id,
         p.freelancer_payout_status, p.operations_status, p.payment_status
    into v_project
    from public.projects p
   where p.id = p_project_id
   for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'EARNING_NOT_RELEASABLE');
  end if;

  select e.project_id, e.freelancer_id, e.status
    into v_earning
    from public.project_earnings e
   where e.project_id = p_project_id
   for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'EARNING_NOT_RELEASABLE');
  end if;

  -- A retried request after commit returns success without repeating side effects.
  if v_project.freelancer_payout_status = 'released'
     and v_earning.status = 'released'
     and v_earning.freelancer_id = v_project.assigned_freelancer_id then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'duplicate', true,
      'projectId', v_project.id,
      'title', v_project.title,
      'freelancerId', v_earning.freelancer_id
    );
  end if;

  if v_project.freelancer_payout_status <> 'releasable'
     or v_project.operations_status <> 'approved'
     or v_project.payment_status <> 'PAYMENT_CONFIRMED'
     or v_project.assigned_freelancer_id is null
     or v_earning.status <> 'releasable'
     or v_earning.freelancer_id <> v_project.assigned_freelancer_id then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'EARNING_NOT_RELEASABLE');
  end if;

  update public.project_earnings
     set status = 'released', released_at = v_now
   where project_id = p_project_id and status = 'releasable';
  if not found then
    raise exception 'PROJECT_EARNING_STATE_CHANGED';
  end if;

  update public.projects
     set freelancer_payout_status = 'released'
   where id = p_project_id
     and freelancer_payout_status = 'releasable'
     and operations_status = 'approved'
     and payment_status = 'PAYMENT_CONFIRMED';
  if not found then
    raise exception 'PROJECT_PAYOUT_STATE_CHANGED';
  end if;

  insert into public.project_events (
    project_id, actor_id, actor_kind, event_type, metadata
  ) values (
    p_project_id, p_admin_user_id, 'admin', 'freelancer_payout_released',
    pg_catalog.jsonb_build_object('reference', p_reference)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'duplicate', false,
    'projectId', v_project.id,
    'title', v_project.title,
    'freelancerId', v_project.assigned_freelancer_id
  );
end;
$$;

revoke all on function public.release_project_earning_atomic(uuid, uuid, text) from public;
revoke all on function public.release_project_earning_atomic(uuid, uuid, text) from anon;
revoke all on function public.release_project_earning_atomic(uuid, uuid, text) from authenticated;
grant execute on function public.release_project_earning_atomic(uuid, uuid, text) to service_role;


-- Resolve project disputes atomically so refund state cannot race payout release.
create or replace function public.resolve_project_dispute_atomic(
  p_dispute_id uuid,
  p_admin_user_id uuid,
  p_outcome text,
  p_resolution text,
  p_refund_amount numeric,
  p_refund_reference text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project record;
  v_dispute record;
  v_earning_status text;
  v_now timestamptz := pg_catalog.now();
begin
  if p_dispute_id is null
     or p_admin_user_id is null
     or p_outcome not in ('resolved', 'refunded', 'rejected')
     or p_resolution is null
     or pg_catalog.length(pg_catalog.btrim(p_resolution)) < 3
     or pg_catalog.length(p_resolution) > 3000 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'INVALID_DISPUTE_RESOLUTION');
  end if;

  -- Match the project-payout RPC's lock order: project first, then child rows.
  select p.id, p.client_price, p.payment_status, p.operations_status,
         p.freelancer_payout_status, p.assigned_freelancer_id
    into v_project
    from public.projects p
   where p.id = (select d.project_id from public.project_disputes d where d.id = p_dispute_id)
   for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'DISPUTE_NOT_FOUND');
  end if;

  select d.id, d.project_id, d.status
    into v_dispute
    from public.project_disputes d
   where d.id = p_dispute_id
   for update;

  if not found or v_dispute.status not in ('open', 'under_review') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'DISPUTE_NOT_OPEN');
  end if;

  if p_outcome = 'refunded' then
    if p_refund_reference is null
       or pg_catalog.length(pg_catalog.btrim(p_refund_reference)) = 0
       or pg_catalog.length(p_refund_reference) > 200
       or p_refund_amount is null
       or p_refund_amount <= 0
       or v_project.client_price is null
       or p_refund_amount > v_project.client_price then
      return pg_catalog.jsonb_build_object('ok', false, 'error', 'INVALID_REFUND_AMOUNT_OR_REFERENCE');
    end if;
    if v_project.payment_status <> 'PAYMENT_CONFIRMED' then
      return pg_catalog.jsonb_build_object('ok', false, 'error', 'PROJECT_PAYMENT_NOT_CONFIRMED');
    end if;

    select e.status
      into v_earning_status
      from public.project_earnings e
     where e.project_id = v_project.id
     for update;

    if found and v_earning_status = 'released' then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'error', 'PAYOUT_ALREADY_RELEASED_REQUIRES_MANUAL_RECONCILIATION'
      );
    end if;
    if v_project.freelancer_payout_status = 'released' then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'error', 'PAYOUT_ALREADY_RELEASED_REQUIRES_MANUAL_RECONCILIATION'
      );
    end if;
  end if;

  update public.project_disputes
     set status = p_outcome,
         resolution = pg_catalog.btrim(p_resolution),
         refund_amount = case when p_outcome = 'refunded' then pg_catalog.round(p_refund_amount, 2) else null end,
         refund_reference = case when p_outcome = 'refunded' then pg_catalog.btrim(p_refund_reference) else null end,
         resolved_by = p_admin_user_id,
         resolved_at = v_now
   where id = p_dispute_id and status in ('open', 'under_review');
  if not found then
    raise exception 'DISPUTE_STATE_CHANGED';
  end if;

  if p_outcome = 'refunded' then
    update public.project_earnings
       set status = 'reversed'
     where project_id = v_project.id and status in ('held', 'releasable');
    update public.projects
       set operations_status = 'refunded',
           payment_status = 'PAYMENT_REFUNDED',
           freelancer_payout_status = 'reversed'
     where id = v_project.id;
  else
    update public.projects
       set operations_status = case when p_outcome = 'resolved' then 'approved' else 'delivered' end
     where id = v_project.id;
  end if;

  insert into public.project_events (
    project_id, actor_id, actor_kind, event_type, metadata
  ) values (
    v_project.id, p_admin_user_id, 'admin', 'dispute_' || p_outcome,
    pg_catalog.jsonb_build_object(
      'disputeId', p_dispute_id,
      'refundAmount', case when p_outcome = 'refunded' then pg_catalog.round(p_refund_amount, 2) else null end,
      'refundReference', case when p_outcome = 'refunded' then pg_catalog.btrim(p_refund_reference) else null end
    )
  );

  return pg_catalog.jsonb_build_object('ok', true, 'disputeId', p_dispute_id, 'projectId', v_project.id);
end;
$$;

revoke all on function public.resolve_project_dispute_atomic(uuid, uuid, text, text, numeric, text) from public;
revoke all on function public.resolve_project_dispute_atomic(uuid, uuid, text, text, numeric, text) from anon;
revoke all on function public.resolve_project_dispute_atomic(uuid, uuid, text, text, numeric, text) from authenticated;
grant execute on function public.resolve_project_dispute_atomic(uuid, uuid, text, text, numeric, text) to service_role;

commit;
