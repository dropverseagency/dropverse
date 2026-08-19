-- DropVerse invoices: sellers create invoices for projects; invoices get public
-- payment links that clients can open (and pay via SpaceRemit) WITHOUT logging in.

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- owner of the project (seller)
  organization_id uuid,

  -- what the client sees
  invoice_number text NOT NULL,      -- e.g. INV-000001
  client_name text,                  -- client display name shown on the invoice
  client_email text,                 -- shown on the invoice (informational)
  currency text NOT NULL DEFAULT 'USD',
  amount numeric NOT NULL CHECK (amount > 0),

  status text NOT NULL DEFAULT 'PENDING',
  -- PENDING -> client can pay | PAID -> payment confirmed | CANCELLED -> dead link

  -- SpaceRemit payment tracking (same mechanism as projects)
  spaceremit_payment_id text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- one open invoice per project keeps flows simple
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices (project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices (invoice_number);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read invoices (owner fetches from dashboard;
-- admin fetches for support). Public (anon) reads are handled by the
-- dedicated /api/invoices/public route using the service role, so no
-- anon SELECT policy is exposed here.
CREATE POLICY "invoices owner read" ON public.invoices
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "invoices owner write" ON public.invoices
  FOR ALL USING (user_id = auth.uid());

-- Owner-only status updates, same guard as project payment confirm.
CREATE POLICY "invoices owner status update" ON public.invoices
  FOR UPDATE USING (user_id = auth.uid());

-- updated_at auto-refresh
CREATE OR REPLACE FUNCTION public.invoices_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_biu ON public.invoices;
CREATE TRIGGER invoices_biu
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_update_timestamp();
