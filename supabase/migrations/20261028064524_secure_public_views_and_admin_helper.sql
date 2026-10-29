
-- Make the public domain-routing view honor the caller's RLS policies.
ALTER VIEW public.agency_custom_domain_routes SET (security_invoker = true);

-- Only verified domain-routing fields are needed by the public view.
DROP POLICY IF EXISTS "public verified custom domains" ON public.agency_custom_domains;
CREATE POLICY "public verified custom domains"
  ON public.agency_custom_domains
  FOR SELECT
  TO anon, authenticated
  USING (status = 'verified');

REVOKE ALL PRIVILEGES ON TABLE public.agency_custom_domains FROM PUBLIC, anon, authenticated;
GRANT SELECT (hostname, landing_page_id, status)
  ON TABLE public.agency_custom_domains TO anon, authenticated;

-- This internal catalog view includes freelancer IDs and operational metrics.
-- It is not referenced by the app repository; keep it available only to trusted server roles.
ALTER VIEW public.sample_sellable_catalog SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.sample_sellable_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.sample_sellable_catalog TO service_role;

-- is_admin() only checks the caller's own profile row; invoker rights let profile RLS apply.
ALTER FUNCTION public.is_admin() SECURITY INVOKER;
ALTER FUNCTION public.is_admin() SET search_path = pg_catalog, public;
