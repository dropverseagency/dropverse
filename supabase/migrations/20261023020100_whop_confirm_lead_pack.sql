-- Atomic lead-pack payment confirmation for signed Whop webhook events.
BEGIN;

CREATE OR REPLACE FUNCTION public.whop_confirm_lead_pack_purchase(
  p_purchase_id uuid,
  p_payment_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.lead_pack_purchases%ROWTYPE;
  v_pack public.lead_packs%ROWTYPE;
  v_effective integer;
  v_new_sold integer;
  v_balance numeric(12,2);
BEGIN
  SELECT * INTO v_purchase
  FROM public.lead_pack_purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;
  IF v_purchase.status = 'paid' THEN
    RETURN true;
  END IF;
  IF v_purchase.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'purchase_not_pending';
  END IF;

  SELECT * INTO v_pack
  FROM public.lead_packs
  WHERE id = v_purchase.pack_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack_not_found';
  END IF;

  v_effective := LEAST(v_pack.max_buyers, COALESCE(v_pack.admin_max_buyers, v_pack.max_buyers));
  IF v_pack.sold_count >= v_effective THEN
    RAISE EXCEPTION 'pack_sold_out';
  END IF;

  UPDATE public.lead_pack_purchases
  SET status = 'paid',
      payment_provider = 'WHOP',
      spaceremit_payment_id = p_payment_id,
      paid_at = now()
  WHERE id = p_purchase_id AND status = 'pending_payment';

  v_new_sold := v_pack.sold_count + 1;
  UPDATE public.lead_packs
  SET sold_count = v_new_sold,
      status = CASE WHEN v_new_sold >= v_effective THEN 'sold_out' ELSE status END
  WHERE id = v_pack.id;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.lead_marketplace_ledger
  WHERE seller_id = v_pack.seller_id;
  v_balance := round(v_balance + v_purchase.seller_net_usd, 2);

  INSERT INTO public.lead_marketplace_ledger
    (seller_id, purchase_id, event, amount, balance_after, note)
  VALUES
    (v_pack.seller_id, p_purchase_id, 'sale_credit', v_purchase.seller_net_usd, v_balance,
     'Whop sale of pack ' || v_pack.id::text);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.whop_confirm_lead_pack_purchase(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whop_confirm_lead_pack_purchase(uuid, text) TO service_role;

COMMIT;
