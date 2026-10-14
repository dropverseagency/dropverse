-- Expand payment_method check to include PENDING_MANUAL.
-- Safe for existing rows: only adds a new allowed value.
-- Apply on Supabase BEFORE deploying the code that writes PENDING_MANUAL.
--
-- Test on a Supabase branch or backup first.
-- Rollback SQL is documented at the bottom of this file.

BEGIN;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_payment_method_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_payment_method_check
  CHECK (
    payment_method = ANY (
      ARRAY[
        'CLIENT_PAYS_DROPVERSE'::text,
        'SELLER_COLLECTED'::text,
        'SPACEREMIT'::text,
        'INVOICE_SEND'::text,
        'PENDING_MANUAL'::text
      ]
    )
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- ROLLBACK (run only if you need to revert; fails if any row uses PENDING_MANUAL)
-- First check: SELECT count(*) FROM public.projects WHERE payment_method = 'PENDING_MANUAL';
-- If count > 0, update or delete those rows before rolling back.
--
-- BEGIN;
-- ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_payment_method_check;
-- ALTER TABLE public.projects ADD CONSTRAINT projects_payment_method_check
--   CHECK (payment_method = ANY (ARRAY[
--     'CLIENT_PAYS_DROPVERSE'::text,
--     'SELLER_COLLECTED'::text,
--     'SPACEREMIT'::text,
--     'INVOICE_SEND'::text
--   ]));
-- COMMIT;
-- ---------------------------------------------------------------------------
