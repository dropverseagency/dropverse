-- Atomically release approved project earnings with an auditable transfer reference.
create or replace function public.release_project_earning_atomic(
  p_project_id uuid,
  p_admin_id uuid,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_reference text;
begin
  if p_project_id is null or p_admin_id is null then
    raise exception 'INVALID_RELEASE_REQUEST' using errcode = '22023';
  end if;

  v_reference := nullif(left(trim(coalesce(p_reference, '')), 200), '');
  if v_reference is null then
    raise exception 'TRANSFER_REFERENCE_REQUIRED' using errcode = '22023';
  end if;

  select *
    into v_project
    from public.projects
   where id = p_project_id
   for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  if v_project.freelancer_payout_status = 'released' then
    if exists (
      select 1
        from public.project_events
       where project_id = p_project_id
         and event_type = 'freelancer_payout_released'
         and metadata ->> 'reference' = v_reference
    ) then
      return jsonb_build_object(
        'ok', true,
        'alreadyReleased', true,
        'freelancerId', v_project.assigned_freelancer_id,
        'projectTitle', v_project.title
      );
    end if;
    raise exception 'EARNING_ALREADY_RELEASED';
  end if;

  if v_project.freelancer_payout_status is distinct from 'releasable'
     or v_project.operations_status is distinct from 'approved'
     or v_project.payment_status is distinct from 'PAYMENT_CONFIRMED'
     or v_project.assigned_freelancer_id is null then
    raise exception 'EARNING_NOT_RELEASABLE';
  end if;

  perform 1
    from public.project_earnings
   where project_id = p_project_id
     and freelancer_id = v_project.assigned_freelancer_id
     and status = 'releasable'
   for update;

  if not found then
    raise exception 'PROJECT_EARNING_NOT_RELEASABLE';
  end if;

  update public.project_earnings
     set status = 'released',
         released_at = now()
   where project_id = p_project_id
     and freelancer_id = v_project.assigned_freelancer_id
     and status = 'releasable';

  update public.projects
     set freelancer_payout_status = 'released'
   where id = p_project_id;

  insert into public.project_events (
    project_id, actor_id, actor_kind, event_type, metadata
  ) values (
    p_project_id, p_admin_id, 'admin', 'freelancer_payout_released',
    jsonb_build_object('reference', v_reference)
  );

  return jsonb_build_object(
    'ok', true,
    'alreadyReleased', false,
    'freelancerId', v_project.assigned_freelancer_id,
    'projectTitle', v_project.title
  );
end;
$$;

revoke all on function public.release_project_earning_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_project_earning_atomic(uuid, uuid, text) to service_role;
