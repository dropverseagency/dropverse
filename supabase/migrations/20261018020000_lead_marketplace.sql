-- Lead Marketplace MVP (packs only).
-- Additive. Does not alter projects, referrals, invoices, or agency tables.
-- Apply on Supabase only after owner review. Do not run against production blindly.
--
-- ROLLBACK: see supabase/rollbacks/20261018020000_lead_marketplace_rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Config (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_marketplace_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_rate numeric NOT NULL DEFAULT 0.20
    CHECK (commission_rate >= 0 AND commission_rate < 1),
  default_max_buyers integer NOT NULL DEFAULT 10 CHECK (default_max_buyers >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.lead_marketplace_config (id, commission_rate, default_max_buyers)
VALUES (1, 0.20, 10)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Lead packs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '',
  niche text NOT NULL DEFAULT '',
  countries text[] NOT NULL DEFAULT '{}',
  price_usd numeric NOT NULL CHECK (price_usd > 0),
  currency text NOT NULL DEFAULT 'USD',
  max_buyers integer NOT NULL DEFAULT 10 CHECK (max_buyers >= 1),
  admin_max_buyers integer NULL CHECK (admin_max_buyers IS NULL OR admin_max_buyers >= 1),
  sold_count integer NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'suspended',
      'sold_out'
    )),
  preview_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_attestation text NOT NULL DEFAULT '',
  resale_rights_ack boolean NOT NULL DEFAULT false,
  storage_path text,
  file_sha256 text,
  file_bytes integer,
  file_content_type text,
  reject_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_packs_sold_lte_max CHECK (
    sold_count <= max_buyers
    AND (admin_max_buyers IS NULL OR sold_count <= admin_max_buyers)
  )
);

CREATE INDEX IF NOT EXISTS idx_lead_packs_status_approved
  ON public.lead_packs (status, created_at DESC)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_lead_packs_seller
  ON public.lead_packs (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_packs_pending
  ON public.lead_packs (created_at DESC)
  WHERE status = 'pending_review';

CREATE OR REPLACE FUNCTION public.lead_packs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_packs_biu ON public.lead_packs;
CREATE TRIGGER lead_packs_biu
  BEFORE UPDATE ON public.lead_packs
  FOR EACH ROW EXECUTE FUNCTION public.lead_packs_set_updated_at();

-- Public-safe view: never exposes storage_path / file hashes to clients via RLS tables.
CREATE OR REPLACE VIEW public.lead_packs_public
WITH (security_invoker = true)
AS
SELECT
  id,
  seller_id,
  title,
  description,
  niche,
  countries,
  price_usd,
  currency,
  max_buyers,
  admin_max_buyers,
  sold_count,
  LEAST(max_buyers, COALESCE(admin_max_buyers, max_buyers)) AS effective_max_buyers,
  GREATEST(
    0,
    LEAST(max_buyers, COALESCE(admin_max_buyers, max_buyers)) - sold_count
  ) AS remaining_seats,
  status,
  preview_meta,
  created_at,
  updated_at
FROM public.lead_packs
WHERE status IN ('approved', 'sold_out');

-- ---------------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_pack_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.lead_packs(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_usd numeric NOT NULL CHECK (price_usd > 0),
  commission_rate numeric NOT NULL CHECK (commission_rate >= 0 AND commission_rate < 1),
  platform_fee_usd numeric NOT NULL CHECK (platform_fee_usd >= 0),
  seller_net_usd numeric NOT NULL CHECK (seller_net_usd >= 0),
  payment_provider text NOT NULL DEFAULT 'SPACEREMIT',
  spaceremit_payment_id text,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'refunded', 'cancelled')),
  idempotency_key text NOT NULL,
  complaint_note text,
  complaint_at timestamptz,
  refund_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_pack_purchases_buyer_unique UNIQUE (pack_id, buyer_id),
  CONSTRAINT lead_pack_purchases_idem UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_lead_purchases_buyer
  ON public.lead_pack_purchases (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_purchases_pack
  ON public.lead_pack_purchases (pack_id, status);

CREATE INDEX IF NOT EXISTS idx_lead_purchases_payment
  ON public.lead_pack_purchases (spaceremit_payment_id)
  WHERE spaceremit_payment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seller ledger (separate from referral commission_ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_marketplace_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES public.lead_pack_purchases(id) ON DELETE SET NULL,
  event text NOT NULL CHECK (event IN (
    'sale_credit',
    'refund_debit',
    'payout',
    'adjustment'
  )),
  amount numeric NOT NULL,
  balance_after numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_ledger_seller
  ON public.lead_marketplace_ledger (seller_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Payout requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  admin_note text
);

CREATE INDEX IF NOT EXISTS idx_lead_payouts_seller
  ON public.lead_payout_requests (seller_id, requested_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_marketplace_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_marketplace_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_payout_requests ENABLE ROW LEVEL SECURITY;

-- Config: public read of rates (no secrets); writes via service role / admin API only
DROP POLICY IF EXISTS "lead config public read" ON public.lead_marketplace_config;
CREATE POLICY "lead config public read" ON public.lead_marketplace_config
  FOR SELECT USING (true);

-- Packs: sellers manage own; public never reads storage_path via table (use view + APIs)
DROP POLICY IF EXISTS "lead packs seller select" ON public.lead_packs;
CREATE POLICY "lead packs seller select" ON public.lead_packs
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "lead packs public approved select" ON public.lead_packs;
CREATE POLICY "lead packs public approved select" ON public.lead_packs
  FOR SELECT USING (status IN ('approved', 'sold_out'));

DROP POLICY IF EXISTS "lead packs seller insert" ON public.lead_packs;
CREATE POLICY "lead packs seller insert" ON public.lead_packs
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "lead packs seller update" ON public.lead_packs;
CREATE POLICY "lead packs seller update" ON public.lead_packs
  FOR UPDATE USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "lead packs admin all" ON public.lead_packs;
CREATE POLICY "lead packs admin all" ON public.lead_packs
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Purchases
DROP POLICY IF EXISTS "lead purchases buyer select" ON public.lead_pack_purchases;
CREATE POLICY "lead purchases buyer select" ON public.lead_pack_purchases
  FOR SELECT USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "lead purchases seller select" ON public.lead_pack_purchases;
CREATE POLICY "lead purchases seller select" ON public.lead_pack_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lead_packs p
      WHERE p.id = pack_id AND p.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lead purchases admin all" ON public.lead_pack_purchases;
CREATE POLICY "lead purchases admin all" ON public.lead_pack_purchases
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Ledger / payouts: owner read; mutations via service role in APIs
DROP POLICY IF EXISTS "lead ledger seller select" ON public.lead_marketplace_ledger;
CREATE POLICY "lead ledger seller select" ON public.lead_marketplace_ledger
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "lead ledger admin select" ON public.lead_marketplace_ledger;
CREATE POLICY "lead ledger admin select" ON public.lead_marketplace_ledger
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "lead payouts seller select" ON public.lead_payout_requests;
CREATE POLICY "lead payouts seller select" ON public.lead_payout_requests
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "lead payouts seller insert" ON public.lead_payout_requests;
CREATE POLICY "lead payouts seller insert" ON public.lead_payout_requests
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "lead payouts admin all" ON public.lead_payout_requests;
CREATE POLICY "lead payouts admin all" ON public.lead_payout_requests
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;
