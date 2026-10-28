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

commit;
