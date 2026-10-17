-- Protect profiles.role: normal users cannot change their own role.
-- Apply in Supabase SQL Editor after review. Code does not depend on this for boot.

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles own update" ON public.profiles;

CREATE POLICY "profiles_own_update_no_role_change"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF coalesce(auth.jwt() ->> 'role', '') NOT IN ('service_role')
       AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'role_change_forbidden'
        USING ERRCODE = '42501',
              HINT = 'Only service role can change profiles.role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- Rollback:
-- DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
-- DROP FUNCTION IF EXISTS public.prevent_profile_role_escalation();
-- DROP POLICY IF EXISTS "profiles_own_update_no_role_change" ON public.profiles;
-- CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
