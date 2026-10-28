-- Atomic lead-pack seat reservations and payment confirmation.
-- Apply only after reviewing the PR and verifying the matching application code.

alter table public.lead_pack_purchases
  add column if not exists expires_at timestamptz;

update public.lead_pack_purchases
set expires_at = created_at + interval '30 minutes'
where status = 'pending_payment' and expires_at is null;

drop index if exists public.lead_pack_purchases_buyer_unique;
create unique index if not exists lead_pack_purchases_buyer_active_unique
  on public.lead_pack_purchases (pack_id, buyer_id)
  where status in ('pending_payment', 'paid');

create unique index if not exists lead_pack_purchases_payment_id_unique
  on public.lead_pack_purchases (spaceremit_payment_id)
  where spaceremit_payment_id is not null;

create unique index if not exists lead_marketplace_ledger_sale_credit_unique
  on public.lead_marketplace_ledger (purchase_id)
  where event = 'sale_credit' and purchase_id is not null;

create index if not exists lead_pack_purchases_active_reservations
  on public.lead_pack_purchases (pack_id, expires_at)
  where status = 'pending_payment';

create or replace function public.create_lead_pack_purchase_atomic(
  p_pack_id uuid,
  p_buyer_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack public.lead_packs%rowtype;
  v_purchase public.lead_pack_purchases%rowtype;
  v_existing public.lead_pack_purchases%rowtype;
  v_effective integer;
  v_pending integer;
  v_rate numeric := 0.20;
  v_price numeric;
  v_fee numeric;
  v_net numeric;
begin
  select * into v_pack
  from public.lead_packs
  where id = p_pack_id
  for update;

  if not found then raise exception 'NOT_FOUND'; end if;
  if v_pack.status <> 'approved' then raise exception 'NOT_FOR_SALE'; end if;
  if v_pack.seller_id = p_buyer_id then raise exception 'CANNOT_BUY_OWN'; end if;

  select * into v_existing
  from public.lead_pack_purchases
  where pack_id = p_pack_id
    and buyer_id = p_buyer_id
    and status in ('pending_payment', 'paid')
  order by created_at desc
  limit 1
  for update;

  if found and v_existing.status = 'paid' then
    raise exception 'ALREADY_PURCHASED';
  end if;

  if found and v_existing.status = 'pending_payment'
     and coalesce(v_existing.expires_at, v_existing.created_at + interval '30 minutes') > now() then
    return jsonb_build_object(
      'purchaseId', v_existing.id,
      'amount', v_existing.price_usd,
      'currency', v_pack.currency,
      'idempotencyKey', v_existing.idempotency_key,
      'expiresAt', v_existing.expires_at,
      'alreadyPending', true
    );
  end if;

  if found and v_existing.status = 'pending_payment' then
    update public.lead_pack_purchases
    set status = 'cancelled'
    where id = v_existing.id and status = 'pending_payment';
  end if;

  v_effective := least(v_pack.max_buyers, coalesce(v_pack.admin_max_buyers, v_pack.max_buyers));
  select count(*) into v_pending
  from public.lead_pack_purchases
  where pack_id = p_pack_id
    and status = 'pending_payment'
    and expires_at > now();

  if v_pack.sold_count + v_pending >= v_effective then
    raise exception 'SOLD_OUT';
  end if;

  v_price := round(v_pack.price_usd, 2);
  if v_price <= 0 then raise exception 'INVALID_LEAD_PRICE'; end if;
  v_fee := round(v_price * v_rate, 2);
  v_net := round(v_price - v_fee, 2);

  insert into public.lead_pack_purchases (
    pack_id, buyer_id, price_usd, commission_rate, platform_fee_usd, seller_net_usd,
    payment_provider, status, idempotency_key, expires_at
  ) values (
    p_pack_id, p_buyer_id, v_price, v_rate, v_fee, v_net,
    'spaceremit', 'pending_payment', p_idempotency_key, now() + interval '30 minutes'
  )
  returning * into v_purchase;

  return jsonb_build_object(
    'purchaseId', v_purchase.id,
    'amount', v_purchase.price_usd,
    'currency', v_pack.currency,
    'idempotencyKey', v_purchase.idempotency_key,
    'expiresAt', v_purchase.expires_at,
    'alreadyPending', false
  );
end;
$$;

create or replace function public.confirm_lead_pack_purchase_atomic(
  p_purchase_id uuid,
  p_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.lead_pack_purchases%rowtype;
  v_pack public.lead_packs%rowtype;
  v_effective integer;
  v_pending_others integer;
  v_new_sold integer;
  v_rate numeric := 0.20;
  v_fee numeric;
  v_net numeric;
  v_balance numeric;
begin
  if nullif(trim(p_payment_id), '') is null then raise exception 'MISSING_PAYMENT_ID'; end if;

  select * into v_purchase
  from public.lead_pack_purchases
  where id = p_purchase_id
  for update;

  if not found then raise exception 'PURCHASE_NOT_FOUND'; end if;

  if v_purchase.status = 'paid' then
    if exists (
      select 1 from public.lead_marketplace_ledger
      where purchase_id = p_purchase_id and event = 'sale_credit'
    ) then
      return jsonb_build_object('ok', true, 'alreadyConfirmed', true);
    end if;
    raise exception 'LEDGER_RECONCILIATION_REQUIRED';
  end if;

  if v_purchase.status <> 'pending_payment'
     and not (v_purchase.status = 'cancelled' and v_purchase.expires_at is not null and v_purchase.expires_at <= now()) then
    raise exception 'NOT_PAYABLE';
  end if;

  if exists (
    select 1 from public.lead_pack_purchases
    where spaceremit_payment_id = p_payment_id and id <> p_purchase_id
  ) then
    raise exception 'PAYMENT_ID_REUSED';
  end if;

  select * into v_pack
  from public.lead_packs
  where id = v_purchase.pack_id
  for update;

  if not found then raise exception 'PACK_NOT_FOUND'; end if;

  v_effective := least(v_pack.max_buyers, coalesce(v_pack.admin_max_buyers, v_pack.max_buyers));
  select count(*) into v_pending_others
  from public.lead_pack_purchases
  where pack_id = v_pack.id
    and id <> p_purchase_id
    and status = 'pending_payment'
    and expires_at > now();

  -- Active pending checkouts reserve seats. A late payment may only be accepted if
  -- a seat is still available; otherwise support must reconcile/refund it manually.
  if v_pack.status <> 'approved'
     or v_pack.sold_count + v_pending_others >= v_effective then
    raise exception 'SOLD_OUT_PAYMENT_REQUIRES_REVIEW';
  end if;

  v_fee := round(v_purchase.price_usd * v_rate, 2);
  v_net := round(v_purchase.price_usd - v_fee, 2);

  update public.lead_pack_purchases
  set status = 'paid',
      commission_rate = v_rate,
      platform_fee_usd = v_fee,
      seller_net_usd = v_net,
      spaceremit_payment_id = p_payment_id,
      paid_at = now(),
      expires_at = null
  where id = p_purchase_id;

  v_new_sold := v_pack.sold_count + 1;
  update public.lead_packs
  set sold_count = v_new_sold,
      status = case when v_new_sold >= v_effective then 'sold_out' else 'approved' end,
      updated_at = now()
  where id = v_pack.id;

  perform pg_advisory_xact_lock(hashtext(v_pack.seller_id::text)::bigint);
  select coalesce(sum(amount), 0) into v_balance
  from public.lead_marketplace_ledger
  where seller_id = v_pack.seller_id;
  v_balance := round(v_balance + v_net, 2);

  insert into public.lead_marketplace_ledger (
    seller_id, purchase_id, event, amount, balance_after, note
  ) values (
    v_pack.seller_id, p_purchase_id, 'sale_credit', v_net, v_balance,
    'Lead pack sale; platform commission 20%'
  );

  return jsonb_build_object(
    'ok', true,
    'confirmed', true,
    'amount', v_purchase.price_usd,
    'platformFee', v_fee,
    'sellerNet', v_net,
    'commissionRate', v_rate
  );
end;
$$;

revoke all on function public.create_lead_pack_purchase_atomic(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_lead_pack_purchase_atomic(uuid, text) from public, anon, authenticated;
grant execute on function public.create_lead_pack_purchase_atomic(uuid, uuid, text) to service_role;
grant execute on function public.confirm_lead_pack_purchase_atomic(uuid, text) to service_role;
