-- Project operations v2: secure client portal, revision invoices and payout balance integration.

alter table public.invoices add column if not exists kind text not null default 'project'
  check (kind in ('project','revision'));
alter table public.invoices add column if not exists revision_request_id uuid
  references public.project_revision_requests(id) on delete cascade;
alter table public.invoices drop constraint if exists invoices_project_id_key;
create unique index if not exists invoices_one_project_invoice_idx
  on public.invoices(project_id) where kind = 'project';
create unique index if not exists invoices_one_revision_invoice_idx
  on public.invoices(revision_request_id) where revision_request_id is not null;

alter table public.project_client_tokens add column if not exists last_used_at timestamptz;
alter table public.project_client_tokens add column if not exists label text not null default 'Client portal';

alter table public.project_disputes add column if not exists refund_amount numeric(12,2)
  check (refund_amount is null or refund_amount >= 0);
alter table public.project_disputes add column if not exists refund_reference text;

create or replace function public.get_payout_balance_summary(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pending_commissions numeric(12,2); v_available_commissions numeric(12,2); v_paid_commissions numeric(12,2);
  v_pending_projects numeric(12,2); v_available_projects numeric(12,2); v_paid_projects numeric(12,2);
  v_non_usd_count bigint; v_open_payouts numeric(12,2); v_paid_payouts numeric(12,2); v_available_total numeric(12,2);
begin
  if p_user_id is null then raise exception 'INVALID_USER_ID' using errcode = '22023'; end if;
  select coalesce(sum(rc.commission_amount) filter (where rc.status in ('pending','approved')),0),
         coalesce(sum(rc.commission_amount) filter (where rc.status='available'),0),
         coalesce(sum(rc.commission_amount) filter (where rc.status='paid'),0),
         count(*) filter (where upper(coalesce(rc.currency,'USD')) <> 'USD')
    into v_pending_commissions,v_available_commissions,v_paid_commissions,v_non_usd_count
    from public.referral_commissions rc join public.referrals r on r.id=rc.referral_id where r.referrer_id=p_user_id;
  if v_non_usd_count > 0 then raise exception 'NON_USD_COMMISSION_IN_USD_PAYOUT_LEDGER' using errcode='22023'; end if;
  select coalesce(sum(amount) filter(where status='held'),0), coalesce(sum(amount) filter(where status='releasable'),0), coalesce(sum(amount) filter(where status='released'),0)
    into v_pending_projects,v_available_projects,v_paid_projects from public.project_earnings where freelancer_id=p_user_id;
  select coalesce(sum(amount) filter(where status in ('pending','approved')),0), coalesce(sum(amount) filter(where status='paid'),0)
    into v_open_payouts,v_paid_payouts from public.payout_requests where user_id=p_user_id;
  -- Project earnings use the protected admin release flow with an external
  -- transfer reference. Keep them separate from referral payout requests.
  v_available_total := v_available_commissions;
  return jsonb_build_object(
    'pending',v_pending_commissions+v_pending_projects,
    'availableCommissions',v_available_commissions,
    'releasableProjectEarnings',v_available_projects,
    'available',greatest(0,round((v_available_total-v_open_payouts)::numeric,2)),
    'processing',v_open_payouts,'paidCommissions',v_paid_commissions,
    'releasedProjectEarnings',v_paid_projects,'totalPaidPayouts',v_paid_payouts);
end; $$;
revoke all on function public.get_payout_balance_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_payout_balance_summary(uuid) to service_role;

-- The existing atomic request function remains the only payout-request writer.
-- Include releasable project earnings in its locked balance calculation.
create or replace function public.project_payout_available(p_user_id uuid)
returns numeric language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(sum(amount),0)::numeric(12,2) from public.project_earnings
  where freelancer_id=p_user_id and status='releasable'
$$;
revoke all on function public.project_payout_available(uuid) from public, anon, authenticated;
grant execute on function public.project_payout_available(uuid) to service_role;
