-- DropVerse security, observability, and targeted index hardening.
-- Preserve existing row-access predicates and all application CRUD permissions.

-- The previous policy allowed any browser-authenticated caller to update any
-- invitation row. No invitation rows or app acceptance handler exist today.
-- Disable direct browser updates until a token-bound server-side flow is added.
DROP POLICY IF EXISTS "invitations accept anyone with token" ON public.organization_invitations;
REVOKE UPDATE ON TABLE public.organization_invitations FROM PUBLIC, anon, authenticated;

-- Use the actual database execution role for the role-change guard.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'profiles.role cannot be changed by the user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- Browser API roles require CRUD subject to RLS, but never need table-level
-- TRUNCATE, TRIGGER, or REFERENCES privileges.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

-- Future tables created by the normal migration owner get the same hardening.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM PUBLIC, anon, authenticated;

-- Atomic alert deduplication. The function is callable by service_role only.
CREATE OR REPLACE FUNCTION public.claim_ops_alert(
  p_key text,
  p_cooldown_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  claimed boolean;
  cooldown_seconds integer;
BEGIN
  IF p_key IS NULL OR length(p_key) < 1 OR length(p_key) > 128 THEN
    RETURN false;
  END IF;

  cooldown_seconds := greatest(0, least(coalesce(p_cooldown_seconds, 900), 86400));

  INSERT INTO public.ops_alert_dedupe (key, last_sent_at)
  VALUES (p_key, clock_timestamp())
  ON CONFLICT (key) DO UPDATE
    SET last_sent_at = EXCLUDED.last_sent_at
    WHERE public.ops_alert_dedupe.last_sent_at
      < clock_timestamp() - make_interval(secs => cooldown_seconds)
  RETURNING true INTO claimed;

  RETURN coalesce(claimed, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_ops_alert(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ops_alert(text, integer) TO service_role;

-- The admin live-visitors endpoint filters/orders by last_seen. Analytics
-- filters page_views by created_at. These indexes support those exact queries.
CREATE INDEX IF NOT EXISTS idx_site_presence_last_seen_desc
  ON public.site_presence (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at_desc
  ON public.page_views (created_at DESC);

COMMENT ON FUNCTION public.claim_ops_alert(text, integer)
  IS 'Atomic service-role-only alert dedupe claim with configurable cooldown.';
