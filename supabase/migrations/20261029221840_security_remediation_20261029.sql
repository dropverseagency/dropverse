-- DropVerse security remediation: server-only payment, payout, and audit writes.
-- Apply before deploying the matching application changes.
begin;
create table if not exists public.rate_limit_buckets (
  key text primary key, count integer not null default 0 check (count >= 0),
  window_start timestamptz not null, updated_at timestamptz not null default now()
);
create index if not exists idx_rate_limit_buckets_updated on public.rate_limit_buckets (updated_at);
alter table public.rate_limit_buckets enable row level security;
revoke all on table public.rate_limit_buckets from public, anon, authenticated;
create or replace function public.consume_rate_limit_bucket(p_key text,p_limit integer,p_window_ms integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_window_start timestamptz; v_count integer; v_reset_ms bigint;
begin
 if p_key is null or length(p_key)<1 or length(p_key)>450 or p_limit is null or p_limit<1 or p_window_ms is null or p_window_ms<1000 or p_window_ms>86400000 then
   raise exception 'INVALID_RATE_LIMIT_ARGUMENTS' using errcode='22023';
 end if;
 v_window_start:=to_timestamp(floor(extract(epoch from clock_timestamp())*1000/p_window_ms)*p_window_ms/1000);
 insert into public.rate_limit_buckets(key,count,window_start,updated_at) values(p_key,1,v_window_start,now())
 on conflict(key) do update set count=case when public.rate_limit_buckets.window_start=excluded.window_start then public.rate_limit_buckets.count+1 else 1 end,
 window_start=excluded.window_start,updated_at=now() returning count into v_count;
 v_reset_ms:=(extract(epoch from (v_window_start+p_window_ms*interval '1 millisecond'))*1000)::bigint;
 -- Bound table growth from one-off IP/user keys without paying the cleanup cost on every request.
 if random() < 0.01 then
   delete from public.rate_limit_buckets where updated_at < now() - interval '2 hours';
 end if;
 return jsonb_build_object('success',v_count<=p_limit,'limit',p_limit,'remaining',greatest(0,p_limit-v_count),'reset',v_reset_ms,'backend','supabase');
end; $$;
revoke all on function public.consume_rate_limit_bucket(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit_bucket(text,integer,integer) to service_role;

drop policy if exists "projects owners insert" on public.projects;
revoke insert on table public.projects from public,anon,authenticated;
create or replace function public.guard_project_financial_mutations()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text:=coalesce(auth.role(),current_setting('request.jwt.claim.role',true),current_user);
begin
 if v_role='service_role' then return new; end if;
 if tg_op='INSERT' then raise exception 'PROJECT_CREATION_REQUIRES_SERVER_API' using errcode='42501'; end if;
 if row(new.client_price,new.fulfillment_cost,new.seller_profit,new.payment_method,new.payment_status,new.payment_provider,new.payment_transaction_id,new.payment_confirmed_at,new.spaceremit_payment_id,new.status,new.subscription_status,new.current_billing_period,new.next_billing_date,new.freelancer_payout_status,new.freelancer_payout_amount,new.assigned_freelancer_id,new.assignment_status,new.operations_status,new.delivered_at,new.service_start_date,new.service_end_date)
 is distinct from row(old.client_price,old.fulfillment_cost,old.seller_profit,old.payment_method,old.payment_status,old.payment_provider,old.payment_transaction_id,old.payment_confirmed_at,old.spaceremit_payment_id,old.status,old.subscription_status,old.current_billing_period,old.next_billing_date,old.freelancer_payout_status,old.freelancer_payout_amount,old.assigned_freelancer_id,old.assignment_status,old.operations_status,old.delivered_at,old.service_start_date,old.service_end_date) then
 raise exception 'PROJECT_FINANCIAL_OR_STATE_CHANGE_REQUIRES_SERVER_API' using errcode='42501';
 end if;
 return new;
end; $$;
drop trigger if exists guard_project_financial_mutations on public.projects;
create trigger guard_project_financial_mutations before insert or update on public.projects for each row execute function public.guard_project_financial_mutations();

drop policy if exists "invoices owner write" on public.invoices;
drop policy if exists "invoices owner status update" on public.invoices;
revoke insert,update,delete on table public.invoices from public,anon,authenticated;
create or replace function public.guard_invoice_mutations()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text:=coalesce(auth.role(),current_setting('request.jwt.claim.role',true),current_user);
begin
 if v_role='service_role' then if tg_op='DELETE' then return old; end if; return new; end if;
 raise exception 'INVOICE_MUTATION_REQUIRES_SERVER_API' using errcode='42501';
end; $$;
drop trigger if exists guard_invoice_mutations on public.invoices;
create trigger guard_invoice_mutations before insert or update or delete on public.invoices for each row execute function public.guard_invoice_mutations();

drop policy if exists "users create own payouts" on public.payout_requests;
revoke insert,update,delete on table public.payout_requests from public,anon,authenticated;
drop policy if exists "audit_logs api write" on public.audit_logs;
revoke insert,update,delete on table public.audit_logs from public,anon,authenticated;

-- Prevent replaying one verified payment transaction against multiple projects/invoices.
create table if not exists public.payment_transaction_claims (
  provider text not null check (provider in ('SPACEREMIT','PAYPAL')),
  transaction_id text not null check (length(btrim(transaction_id)) between 1 and 255),
  entity_type text not null check (entity_type in ('project','invoice')),
  entity_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (provider, transaction_id)
);
alter table public.payment_transaction_claims enable row level security;
revoke all on table public.payment_transaction_claims from public,anon,authenticated;

create or replace function public.claim_payment_transaction(
  p_provider text, p_transaction_id text, p_entity_type text, p_entity_id uuid
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $claim$
declare v_entity_type text; v_entity_id uuid;
begin
  if coalesce(auth.role(),current_setting('request.jwt.claim.role',true),current_user) <> 'service_role' then
    raise exception 'PAYMENT_CLAIM_REQUIRES_SERVER_API' using errcode='42501';
  end if;
  if p_provider not in ('SPACEREMIT','PAYPAL')
     or p_transaction_id is null or length(btrim(p_transaction_id)) < 1 or length(p_transaction_id) > 255
     or p_entity_type not in ('project','invoice') or p_entity_id is null then
    raise exception 'INVALID_PAYMENT_CLAIM_ARGUMENTS' using errcode='22023';
  end if;
  insert into public.payment_transaction_claims(provider,transaction_id,entity_type,entity_id)
  values (p_provider,btrim(p_transaction_id),p_entity_type,p_entity_id)
  on conflict (provider,transaction_id) do nothing;
  if found then return true; end if;
  select entity_type,entity_id into v_entity_type,v_entity_id
    from public.payment_transaction_claims
    where provider=p_provider and transaction_id=btrim(p_transaction_id);
  return v_entity_type=p_entity_type and v_entity_id=p_entity_id;
end; $claim$;
revoke all on function public.claim_payment_transaction(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_transaction(text,text,text,uuid) to service_role;

commit;
