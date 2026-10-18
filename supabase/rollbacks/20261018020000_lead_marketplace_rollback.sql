-- Rollback Lead Marketplace MVP migration 20261018020000
BEGIN;

DROP VIEW IF EXISTS public.lead_packs_public;

DROP TABLE IF EXISTS public.lead_payout_requests;
DROP TABLE IF EXISTS public.lead_marketplace_ledger;
DROP TABLE IF EXISTS public.lead_pack_purchases;
DROP TABLE IF EXISTS public.lead_packs;
DROP TABLE IF EXISTS public.lead_marketplace_config;

DROP FUNCTION IF EXISTS public.lead_packs_set_updated_at();

COMMIT;
