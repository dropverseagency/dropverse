
-- Keep pg_catalog ahead of application schemas and pg_temp last for SECURITY DEFINER functions.
ALTER FUNCTION dv.is_org_admin(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION dv.is_org_member(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.active_referral_tier(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.check_org_member_limit() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.create_payout_request_atomic(uuid, numeric, text, text, numeric, numeric, text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.create_referral_commission(uuid, uuid, numeric, numeric) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.ensure_personal_workspace() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_payout_balance_summary(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.project_payout_available(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.refresh_freelancer_metrics(uuid) SET search_path = pg_catalog, public, pg_temp;
