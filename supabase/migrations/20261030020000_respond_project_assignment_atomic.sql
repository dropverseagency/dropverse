-- Make freelancer assignment responses atomic and prevent orphaned held earnings.
create or replace function public.respond_project_assignment_atomic(
  p_project_id uuid,
  p_freelancer_id uuid,
  p_decision text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_assignment_id uuid;
begin
  if p_project_id is null or p_freelancer_id is null
     or p_decision is null or p_decision not in ('accepted', 'declined') then
    raise exception 'INVALID_ASSIGNMENT_RESPONSE' using errcode = '22023';
  end if;

  select *
    into v_project
    from public.projects
   where id = p_project_id
   for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  if v_project.assigned_freelancer_id is distinct from p_freelancer_id
     or v_project.assignment_status not in ('offered', 'reassigned')
     or v_project.operations_status <> 'assigned'
     or v_project.payment_status <> 'PAYMENT_CONFIRMED' then
    raise exception 'ASSIGNMENT_NO_LONGER_OPEN';
  end if;

  select id
    into v_assignment_id
    from public.project_assignments
   where project_id = p_project_id
     and freelancer_id = p_freelancer_id
     and status = 'offered'
   order by offered_at desc
   limit 1
   for update;

  if v_assignment_id is null then
    raise exception 'ASSIGNMENT_NO_LONGER_OPEN';
  end if;

  update public.project_assignments
     set status = p_decision,
         responded_at = now(),
         response_note = nullif(left(trim(coalesce(p_note, '')), 1000), '')
   where id = v_assignment_id
     and status = 'offered';

  if p_decision = 'accepted' then
    update public.projects
       set assignment_status = 'accepted',
           operations_status = 'in_progress'
     where id = p_project_id;
  else
    update public.projects
       set assigned_freelancer_id = null,
           assignment_status = 'declined',
           operations_status = 'ready_to_assign',
           freelancer_payout_status = 'not_earned'
     where id = p_project_id;

    update public.project_earnings
       set status = 'reversed'
     where project_id = p_project_id
       and freelancer_id = p_freelancer_id
       and status = 'held';
  end if;

  return jsonb_build_object(
    'ok', true,
    'assignmentId', v_assignment_id,
    'decision', p_decision
  );
end;
$$;

revoke all on function public.respond_project_assignment_atomic(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.respond_project_assignment_atomic(uuid, uuid, text, text) to service_role;
