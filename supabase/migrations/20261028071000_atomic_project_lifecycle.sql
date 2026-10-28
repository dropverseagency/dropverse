-- Atomic project delivery approval and dispute opening.
begin;

create unique index if not exists project_disputes_one_open_per_project_uidx
  on public.project_disputes (project_id)
  where status in ('open', 'under_review');

create or replace function public.approve_project_delivery_atomic(
  p_project_id uuid,
  p_actor_id uuid,
  p_actor_kind text
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
     or p_actor_id is null
     or p_actor_kind not in ('seller', 'admin') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'INVALID_APPROVAL_INPUT');
  end if;

  select p.id, p.title, p.user_id, p.assigned_freelancer_id,
         p.operations_status, p.payment_status, p.freelancer_payout_status, p.client_price
    into v_project
    from public.projects p
   where p.id = p_project_id
   for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'PROJECT_NOT_FOUND');
  end if;

  if v_project.operations_status = 'approved'
     and v_project.payment_status = 'PAYMENT_CONFIRMED'
     and v_project.freelancer_payout_status in ('releasable', 'released') then
    select e.project_id, e.freelancer_id, e.status
      into v_earning
      from public.project_earnings e
     where e.project_id = p_project_id
     for update;
    if found
       and v_earning.freelancer_id = v_project.assigned_freelancer_id
       and ((v_project.freelancer_payout_status = 'releasable' and v_earning.status = 'releasable')
         or (v_project.freelancer_payout_status = 'released' and v_earning.status = 'released')) then
      return pg_catalog.jsonb_build_object(
        'ok', true, 'duplicate', true, 'projectId', v_project.id,
        'title', v_project.title, 'freelancerId', v_project.assigned_freelancer_id
      );
    end if;
  end if;

  if v_project.operations_status <> 'delivered' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'NOT_DELIVERED');
  end if;
  if v_project.payment_status <> 'PAYMENT_CONFIRMED' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_CONFIRMED');
  end if;
  if v_project.assigned_freelancer_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'FREELANCER_NOT_ASSIGNED');
  end if;

  select e.project_id, e.freelancer_id, e.status
    into v_earning
    from public.project_earnings e
   where e.project_id = p_project_id
   for update;

  if not found
     or v_earning.freelancer_id <> v_project.assigned_freelancer_id
     or v_earning.status not in ('held', 'releasable') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'PROJECT_EARNING_NOT_RELEASABLE');
  end if;

  update public.project_earnings
     set status = 'releasable'
   where project_id = p_project_id and status = 'held';
  update public.projects
     set operations_status = 'approved',
         freelancer_payout_status = 'releasable'
   where id = p_project_id
     and operations_status = 'delivered'
     and payment_status = 'PAYMENT_CONFIRMED';
  if not found then
    raise exception 'DELIVERY_APPROVAL_STATE_CHANGED';
  end if;

  insert into public.project_events (
    project_id, actor_id, actor_kind, event_type, metadata
  ) values (
    p_project_id, p_actor_id, p_actor_kind, 'delivery_approved',
    pg_catalog.jsonb_build_object('approvedAt', v_now)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'duplicate', false, 'projectId', v_project.id,
    'title', v_project.title, 'freelancerId', v_project.assigned_freelancer_id
  );
end;
$$;

create or replace function public.open_project_dispute_atomic(
  p_project_id uuid,
  p_user_id uuid,
  p_actor_kind text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project record;
  v_dispute_id uuid;
begin
  if p_project_id is null
     or p_user_id is null
     or p_actor_kind not in ('seller', 'freelancer', 'admin')
     or p_reason is null
     or pg_catalog.length(pg_catalog.btrim(p_reason)) < 10
     or pg_catalog.length(p_reason) > 3000 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'INVALID_DISPUTE_INPUT');
  end if;

  select p.id, p.payment_status, p.operations_status
    into v_project
    from public.projects p
   where p.id = p_project_id
   for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'PROJECT_NOT_FOUND');
  end if;
  if v_project.payment_status <> 'PAYMENT_CONFIRMED' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_CONFIRMED');
  end if;

  if v_project.operations_status = 'disputed' then
    select d.id into v_dispute_id
      from public.project_disputes d
     where d.project_id = p_project_id and d.status in ('open', 'under_review')
     order by d.created_at desc
     limit 1;
    if v_dispute_id is not null then
      return pg_catalog.jsonb_build_object('ok', true, 'duplicate', true, 'disputeId', v_dispute_id);
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'PROJECT_ALREADY_DISPUTED');
  end if;

  if v_project.operations_status in ('refunded', 'cancelled') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'PROJECT_NOT_DISPUTABLE');
  end if;

  insert into public.project_disputes (project_id, opened_by, reason, status)
  values (p_project_id, p_user_id, pg_catalog.btrim(p_reason), 'open')
  returning id into v_dispute_id;

  update public.projects
     set operations_status = 'disputed'
   where id = p_project_id;
  insert into public.project_events (
    project_id, actor_id, actor_kind, event_type, metadata
  ) values (
    p_project_id, p_user_id, p_actor_kind, 'dispute_opened',
    pg_catalog.jsonb_build_object('disputeId', v_dispute_id)
  );

  return pg_catalog.jsonb_build_object('ok', true, 'duplicate', false, 'disputeId', v_dispute_id);
end;
$$;

revoke all on function public.approve_project_delivery_atomic(uuid, uuid, text) from public;
revoke all on function public.approve_project_delivery_atomic(uuid, uuid, text) from anon;
revoke all on function public.approve_project_delivery_atomic(uuid, uuid, text) from authenticated;
grant execute on function public.approve_project_delivery_atomic(uuid, uuid, text) to service_role;

revoke all on function public.open_project_dispute_atomic(uuid, uuid, text, text) from public;
revoke all on function public.open_project_dispute_atomic(uuid, uuid, text, text) from anon;
revoke all on function public.open_project_dispute_atomic(uuid, uuid, text, text) from authenticated;
grant execute on function public.open_project_dispute_atomic(uuid, uuid, text, text) to service_role;

commit;
