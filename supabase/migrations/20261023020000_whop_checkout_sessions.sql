-- Whop checkout mapping: binds a server-created Whop plan to an internal DropVerse purchase.
-- Apply this migration in Supabase before enabling Whop in production.
BEGIN;

CREATE TABLE IF NOT EXISTS public.whop_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  target_type text NOT NULL CHECK (target_type IN ('project', 'lead_pack', 'subscription')),
  target_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  provider_payment_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_whop_checkout_target
  ON public.whop_checkout_sessions (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_whop_checkout_user
  ON public.whop_checkout_sessions (user_id, created_at DESC);

ALTER TABLE public.whop_checkout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own Whop checkout sessions" ON public.whop_checkout_sessions;
CREATE POLICY "Users can read own Whop checkout sessions"
  ON public.whop_checkout_sessions FOR SELECT
  USING (auth.uid() = user_id);

COMMIT;
