-- Samples Vault data model (v5-safe)
-- Production-safe guards: refuse if target objects already exist (no silent replace).
-- Additive only. Does NOT modify profiles.role, protect_profile_role, or payouts.
-- Storage path convention: {owner_id}/{sample_id}/{filename}
-- Owner insert = draft only; pending_review only after file + cost + profile exist.
--
-- Objects this migration may create (for rollback tracking):
--   functions: is_admin, set_updated_at, enforce_freelancer_links_max,
--     enforce_samples_active_max, enforce_owner_insert_draft_only,
--     enforce_sample_owner_insert, enforce_sample_owner_edit_window,
--     enforce_submit_requirements, stamp_rights_on_submit,
--     enforce_sample_files_max, enforce_sample_file_path
--   tables: freelancer_profiles, freelancer_links, samples, sample_costs,
--     sample_files, sample_downloads
--   view: samples_public
--   storage buckets: sample-originals, sample-covers (insert only if missing)
--   policies/triggers only on the six tables above and storage.objects for those buckets

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.freelancer_profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSE: table public.freelancer_profiles already exists; review manually before applying Samples Vault';
  END IF;
  IF to_regclass('public.freelancer_links') IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSE: table public.freelancer_links already exists; review manually before applying Samples Vault';
  END IF;
  IF to_regclass('public.samples') IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSE: table public.samples already exists; review manually before applying Samples Vault';
  END IF;
  IF to_regclass('public.sample_costs') IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSE: table public.sample_costs already exists; review manually before applying Samples Vault';
  END IF;
  IF to_regclass('public.sample_files') IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSE: table public.sample_files already exists; review manually before applying Samples Vault';
  END IF;
  IF to_regclass('public.sample_downloads') IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSE: table public.sample_downloads already exists; review manually before applying Samples Vault';
  END IF;
  IF to_regclass('public.samples_public') IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSE: view public.samples_public already exists; review manually before applying Samples Vault';
  END IF;
END
$guard$;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN
    RAISE NOTICE 'Samples Vault: public.is_admin already exists; leaving definition unchanged';
  ELSE
    EXECUTE $fn$
      CREATE FUNCTION public.is_admin()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        );
      $body$;
    $fn$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.is_admin() FROM public';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated';
  END IF;
END
$guard$;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    RAISE NOTICE 'Samples Vault: public.set_updated_at already exists; leaving definition unchanged';
  ELSE
    EXECUTE $fn$
      CREATE FUNCTION public.set_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public
      AS $body$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $body$;
    $fn$;
  END IF;
END
$guard$;

DO $guard$
DECLARE
  fname text;
BEGIN
  FOREACH fname IN ARRAY ARRAY[
    'enforce_freelancer_links_max',
    'enforce_samples_active_max',
    'enforce_owner_insert_draft_only',
    'enforce_sample_owner_insert',
    'enforce_sample_owner_edit_window',
    'enforce_submit_requirements',
    'stamp_rights_on_submit',
    'enforce_sample_files_max',
    'enforce_sample_file_path'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fname
    ) THEN
      RAISE EXCEPTION 'REFUSE: function public.% already exists; review manually before applying Samples Vault', fname;
    END IF;
  END LOOP;
END
$guard$;

CREATE TABLE IF NOT EXISTS public.freelancer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 80),
  category text NOT NULL CHECK (category IN (
    'Video Editing', 'Graphic Design', 'Web Design', 'Social Media Content',
    'UGC Content', 'Copywriting', 'Branding', 'Motion Graphics'
  )),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freelancer_profiles_category_idx
  ON public.freelancer_profiles (category);

DROP TRIGGER IF EXISTS trg_freelancer_profiles_updated_at ON public.freelancer_profiles;
CREATE TRIGGER trg_freelancer_profiles_updated_at
  BEFORE UPDATE ON public.freelancer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.freelancer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('behance', 'dribbble', 'upwork', 'other')),
  url text NOT NULL CHECK (url ~* '^https://'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freelancer_links_user_idx
  ON public.freelancer_links (user_id);

CREATE FUNCTION public.enforce_freelancer_links_max()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.freelancer_links WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'MAX_LINKS: at most 5 portfolio links per freelancer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freelancer_links_max ON public.freelancer_links;
CREATE TRIGGER trg_freelancer_links_max
  BEFORE INSERT ON public.freelancer_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_freelancer_links_max();

CREATE TABLE IF NOT EXISTS public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  slug text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'Video Editing', 'Graphic Design', 'Web Design', 'Social Media Content',
    'UGC Content', 'Copywriting', 'Branding', 'Motion Graphics'
  )),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_review', 'approved', 'rejected', 'unpublished'
  )),
  price_usd numeric(12, 2) NULL CHECK (price_usd IS NULL OR price_usd >= 0),
  turnaround_days integer NOT NULL CHECK (turnaround_days BETWEEN 1 AND 30),
  rights_attested_at timestamptz NULL,
  rights_terms_version text NULL,
  rejection_reason text NULL,
  reviewed_by uuid NULL REFERENCES auth.users (id),
  reviewed_at timestamptz NULL,
  cover_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT samples_slug_unique UNIQUE (slug),
  CONSTRAINT samples_rights_required CHECK (
    status NOT IN ('pending_review', 'approved')
    OR rights_attested_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS samples_owner_idx ON public.samples (owner_id);
CREATE INDEX IF NOT EXISTS samples_status_idx ON public.samples (status);
CREATE INDEX IF NOT EXISTS samples_category_status_idx ON public.samples (category, status);

DROP TRIGGER IF EXISTS trg_samples_updated_at ON public.samples;
CREATE TRIGGER trg_samples_updated_at
  BEFORE UPDATE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.enforce_samples_active_max()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  active_count int;
BEGIN
  IF NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO active_count
  FROM public.samples
  WHERE owner_id = NEW.owner_id
    AND status <> 'rejected'
    AND (TG_OP = 'INSERT' OR id IS DISTINCT FROM NEW.id);
  IF active_count >= 3 THEN
    RAISE EXCEPTION 'MAX_ACTIVE_SAMPLES: at most 3 non-rejected samples per freelancer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_samples_active_max ON public.samples;
CREATE TRIGGER trg_samples_active_max
  BEFORE INSERT OR UPDATE OF status, owner_id ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_samples_active_max();

CREATE FUNCTION public.enforce_owner_insert_draft_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'FORBIDDEN: owner may only insert draft samples';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sample_owner_insert_draft ON public.samples;
CREATE TRIGGER trg_sample_owner_insert_draft
  BEFORE INSERT ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_insert_draft_only();

CREATE FUNCTION public.enforce_sample_owner_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN: owner_id must be the authenticated user';
  END IF;
  IF NEW.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'FORBIDDEN: owner may only insert draft samples';
  END IF;
  NEW.price_usd := NULL;
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.rejection_reason := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sample_owner_insert ON public.samples;
CREATE TRIGGER trg_sample_owner_insert
  BEFORE INSERT ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sample_owner_insert();

CREATE FUNCTION public.enforce_sample_owner_edit_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF OLD.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'FORBIDDEN: sample is locked while status is %', OLD.status;
  END IF;
  IF NEW.status NOT IN ('draft', 'pending_review') THEN
    RAISE EXCEPTION 'FORBIDDEN: owner may only set draft or pending_review';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.price_usd IS DISTINCT FROM OLD.price_usd
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'FORBIDDEN: owner cannot change review or pricing fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sample_owner_edit ON public.samples;
CREATE TRIGGER trg_sample_owner_edit
  BEFORE UPDATE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sample_owner_edit_window();

CREATE FUNCTION public.enforce_submit_requirements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'pending_review' AND OLD.status IS DISTINCT FROM 'pending_review' THEN
    IF NOT EXISTS (SELECT 1 FROM public.sample_files f WHERE f.sample_id = NEW.id) THEN
      RAISE EXCEPTION 'SUBMIT_REQUIRES_FILE: at least one file is required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sample_costs c WHERE c.sample_id = NEW.id) THEN
      RAISE EXCEPTION 'SUBMIT_REQUIRES_COST: cost is required before submit';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.freelancer_profiles fp WHERE fp.user_id = NEW.owner_id) THEN
      RAISE EXCEPTION 'SUBMIT_REQUIRES_PROFILE: complete your profile first';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_samples_submit_requirements ON public.samples;
CREATE TRIGGER trg_samples_submit_requirements
  BEFORE UPDATE OF status ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submit_requirements();

CREATE FUNCTION public.stamp_rights_on_submit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'pending_review'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending_review') THEN
    NEW.rights_attested_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_samples_stamp_rights ON public.samples;
CREATE TRIGGER trg_samples_stamp_rights
  BEFORE INSERT OR UPDATE OF status ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.stamp_rights_on_submit();

CREATE TABLE IF NOT EXISTS public.sample_costs (
  sample_id uuid PRIMARY KEY REFERENCES public.samples (id) ON DELETE CASCADE,
  cost_usd numeric(12, 2) NOT NULL CHECK (cost_usd >= 1 AND cost_usd <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_sample_costs_updated_at ON public.sample_costs;
CREATE TRIGGER trg_sample_costs_updated_at
  BEFORE UPDATE ON public.sample_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.sample_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.samples (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image', 'pdf', 'video')),
  storage_path text NOT NULL,
  mime text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sample_files_sample_idx ON public.sample_files (sample_id);

CREATE FUNCTION public.enforce_sample_files_max()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.sample_files WHERE sample_id = NEW.sample_id) >= 10 THEN
    RAISE EXCEPTION 'MAX_FILES: at most 10 files per sample';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sample_files_max ON public.sample_files;
CREATE TRIGGER trg_sample_files_max
  BEFORE INSERT ON public.sample_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sample_files_max();

CREATE FUNCTION public.enforce_sample_file_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  SELECT s.owner_id INTO v_owner FROM public.samples s WHERE s.id = NEW.sample_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN: sample not owned by caller';
  END IF;
  IF position('..' IN NEW.storage_path) > 0
     OR split_part(NEW.storage_path, '/', 1) <> v_owner::text
     OR split_part(NEW.storage_path, '/', 2) <> NEW.sample_id::text
     OR split_part(NEW.storage_path, '/', 3) = '' THEN
    RAISE EXCEPTION 'FORBIDDEN: storage_path must be {owner_id}/{sample_id}/{filename}';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sample_file_path ON public.sample_files;
CREATE TRIGGER trg_sample_file_path
  BEFORE INSERT OR UPDATE OF storage_path, sample_id ON public.sample_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sample_file_path();

CREATE TABLE IF NOT EXISTS public.sample_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples (id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.sample_files (id) ON DELETE CASCADE,
  ip text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sample_downloads_user_day_idx
  ON public.sample_downloads (user_id, created_at);

CREATE VIEW public.samples_public
WITH (security_barrier = true)
AS
SELECT
  s.id, s.title, s.slug, s.category, s.description, s.price_usd,
  s.turnaround_days, s.cover_path, s.created_at,
  fp.display_name AS freelancer_display_name,
  fp.category AS freelancer_category
FROM public.samples s
LEFT JOIN public.freelancer_profiles fp ON fp.user_id = s.owner_id
WHERE s.status = 'approved';

GRANT SELECT ON public.samples_public TO anon, authenticated;

ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fp_select_own_or_admin" ON public.freelancer_profiles;
CREATE POLICY "fp_select_own_or_admin" ON public.freelancer_profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "fp_insert_own" ON public.freelancer_profiles;
CREATE POLICY "fp_insert_own" ON public.freelancer_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fp_update_own" ON public.freelancer_profiles;
CREATE POLICY "fp_update_own" ON public.freelancer_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fp_admin_all" ON public.freelancer_profiles;
CREATE POLICY "fp_admin_all" ON public.freelancer_profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "fl_select_owner_or_admin" ON public.freelancer_links;
CREATE POLICY "fl_select_owner_or_admin" ON public.freelancer_links
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "fl_insert_own" ON public.freelancer_links;
CREATE POLICY "fl_insert_own" ON public.freelancer_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fl_update_own" ON public.freelancer_links;
CREATE POLICY "fl_update_own" ON public.freelancer_links
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fl_delete_own" ON public.freelancer_links;
CREATE POLICY "fl_delete_own" ON public.freelancer_links
  FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fl_admin_all" ON public.freelancer_links;
CREATE POLICY "fl_admin_all" ON public.freelancer_links
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "samples_select_owner_or_admin" ON public.samples;
CREATE POLICY "samples_select_owner_or_admin" ON public.samples
  FOR SELECT USING (auth.uid() = owner_id OR public.is_admin());
DROP POLICY IF EXISTS "samples_insert_own" ON public.samples;
CREATE POLICY "samples_insert_own" ON public.samples
  FOR INSERT WITH CHECK (auth.uid() = owner_id AND status = 'draft');
DROP POLICY IF EXISTS "samples_update_own_window" ON public.samples;
CREATE POLICY "samples_update_own_window" ON public.samples
  FOR UPDATE USING ((auth.uid() = owner_id AND status IN ('draft', 'rejected')) OR public.is_admin())
  WITH CHECK ((auth.uid() = owner_id AND status IN ('draft', 'pending_review')) OR public.is_admin());
DROP POLICY IF EXISTS "samples_admin_all" ON public.samples;
CREATE POLICY "samples_admin_all" ON public.samples
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sc_select_owner_admin" ON public.sample_costs;
CREATE POLICY "sc_select_owner_admin" ON public.sample_costs
  FOR SELECT USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.samples s WHERE s.id = sample_costs.sample_id AND s.owner_id = auth.uid()));
DROP POLICY IF EXISTS "sc_insert_owner" ON public.sample_costs;
CREATE POLICY "sc_insert_owner" ON public.sample_costs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.samples s WHERE s.id = sample_id AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sc_update_owner" ON public.sample_costs;
CREATE POLICY "sc_update_owner" ON public.sample_costs
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.samples s WHERE s.id = sample_costs.sample_id AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sc_admin_all" ON public.sample_costs;
CREATE POLICY "sc_admin_all" ON public.sample_costs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sf_select_owner_admin" ON public.sample_files;
CREATE POLICY "sf_select_owner_admin" ON public.sample_files
  FOR SELECT USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.samples s WHERE s.id = sample_files.sample_id AND s.owner_id = auth.uid()));
DROP POLICY IF EXISTS "sf_insert_owner" ON public.sample_files;
CREATE POLICY "sf_insert_owner" ON public.sample_files
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.samples s WHERE s.id = sample_id AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sf_delete_owner" ON public.sample_files;
CREATE POLICY "sf_delete_owner" ON public.sample_files
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.samples s WHERE s.id = sample_files.sample_id AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sf_admin_all" ON public.sample_files;
CREATE POLICY "sf_admin_all" ON public.sample_files
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sd_select_own_or_admin" ON public.sample_downloads;
CREATE POLICY "sd_select_own_or_admin" ON public.sample_downloads
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DO $guard$
DECLARE
  rec record;
BEGIN
  SELECT id, public, file_size_limit INTO rec FROM storage.buckets WHERE id = 'sample-originals';
  IF FOUND THEN
    IF rec.public IS DISTINCT FROM false OR rec.file_size_limit IS DISTINCT FROM 52428800 THEN
      RAISE EXCEPTION 'REFUSE: storage bucket sample-originals exists with different public/file_size_limit; review manually';
    END IF;
    RAISE NOTICE 'Samples Vault: bucket sample-originals already exists with matching basic config; not modifying';
  ELSE
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('sample-originals', 'sample-originals', false, 52428800);
  END IF;
  SELECT id, public, file_size_limit INTO rec FROM storage.buckets WHERE id = 'sample-covers';
  IF FOUND THEN
    IF rec.public IS DISTINCT FROM true OR rec.file_size_limit IS DISTINCT FROM 15728640 THEN
      RAISE EXCEPTION 'REFUSE: storage bucket sample-covers exists with different public/file_size_limit; review manually';
    END IF;
    RAISE NOTICE 'Samples Vault: bucket sample-covers already exists with matching basic config; not modifying';
  ELSE
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('sample-covers', 'sample-covers', true, 15728640);
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "sample_originals_owner_read" ON storage.objects;
CREATE POLICY "sample_originals_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sample-originals' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "sample_originals_owner_write" ON storage.objects;
CREATE POLICY "sample_originals_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sample-originals' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.samples s WHERE s.id::text = (storage.foldername(name))[2] AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sample_originals_owner_update" ON storage.objects;
CREATE POLICY "sample_originals_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sample-originals' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.samples s WHERE s.id::text = (storage.foldername(name))[2] AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sample_originals_owner_delete" ON storage.objects;
CREATE POLICY "sample_originals_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sample-originals' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.samples s WHERE s.id::text = (storage.foldername(name))[2] AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sample_originals_admin_all" ON storage.objects;
CREATE POLICY "sample_originals_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'sample-originals' AND public.is_admin()) WITH CHECK (bucket_id = 'sample-originals' AND public.is_admin());

DROP POLICY IF EXISTS "sample_covers_public_read" ON storage.objects;
CREATE POLICY "sample_covers_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'sample-covers');
DROP POLICY IF EXISTS "sample_covers_owner_write" ON storage.objects;
CREATE POLICY "sample_covers_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sample-covers' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.samples s WHERE s.id::text = (storage.foldername(name))[2] AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sample_covers_owner_update" ON storage.objects;
CREATE POLICY "sample_covers_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sample-covers' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.samples s WHERE s.id::text = (storage.foldername(name))[2] AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sample_covers_owner_delete" ON storage.objects;
CREATE POLICY "sample_covers_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sample-covers' AND (storage.foldername(name))[1] = auth.uid()::text AND EXISTS (SELECT 1 FROM public.samples s WHERE s.id::text = (storage.foldername(name))[2] AND s.owner_id = auth.uid() AND s.status IN ('draft', 'rejected')));
DROP POLICY IF EXISTS "sample_covers_admin_all" ON storage.objects;
CREATE POLICY "sample_covers_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'sample-covers' AND public.is_admin()) WITH CHECK (bucket_id = 'sample-covers' AND public.is_admin());

COMMIT;
