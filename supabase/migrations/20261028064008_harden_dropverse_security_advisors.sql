
-- Pin search_path for functions flagged by the Supabase security advisor.
ALTER FUNCTION public.raise_username_cooldown() SET search_path = pg_catalog, public;
ALTER FUNCTION public.projects_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.projects_enforce_payment_status() SET search_path = pg_catalog, public;
ALTER FUNCTION public.projects_enforce_service_start() SET search_path = pg_catalog, public;
ALTER FUNCTION dv.is_admin() SET search_path = pg_catalog, public;
ALTER FUNCTION public.commission_ledger_track() SET search_path = pg_catalog, public;
ALTER FUNCTION public.services_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.invoices_update_timestamp() SET search_path = pg_catalog, public;
ALTER FUNCTION public.paddle_orders_update_timestamp() SET search_path = pg_catalog, public;
ALTER FUNCTION public.enforce_project_payment_pending() SET search_path = pg_catalog, public;

-- This function is a trigger-only guard and should not be exposed as a callable RPC.
REVOKE EXECUTE ON FUNCTION public.enforce_project_payment_pending() FROM PUBLIC, anon, authenticated;

-- Views are read-only catalog/routing surfaces; remove unnecessary write privileges.
REVOKE ALL PRIVILEGES ON TABLE public.agency_custom_domain_routes FROM anon, authenticated;
GRANT SELECT ON TABLE public.agency_custom_domain_routes TO anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sample_sellable_catalog FROM anon, authenticated;
GRANT SELECT ON TABLE public.sample_sellable_catalog TO anon, authenticated;
