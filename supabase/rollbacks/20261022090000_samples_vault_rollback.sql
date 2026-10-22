-- Rollback for Samples Vault v5-safe
-- Drops ONLY objects this migration is designed to create.
-- Does NOT drop profiles, auth objects, or unrelated tables.
-- storage.objects file contents under sample-originals / sample-covers are NOT deleted.

-- Storage policies created by the migration
DROP POLICY IF EXISTS "sample_covers_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "sample_covers_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "sample_covers_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "sample_covers_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "sample_covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "sample_originals_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "sample_originals_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "sample_originals_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "sample_originals_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "sample_originals_owner_read" ON storage.objects;

-- View created by the migration
DROP VIEW IF EXISTS public.samples_public;

-- Tables created by the migration (triggers/policies cascade with table)
DROP TABLE IF EXISTS public.sample_downloads;
DROP TABLE IF EXISTS public.sample_files;
DROP TABLE IF EXISTS public.sample_costs;
DROP TABLE IF EXISTS public.samples;
DROP TABLE IF EXISTS public.freelancer_links;
DROP TABLE IF EXISTS public.freelancer_profiles;

-- Functions created by the migration (enforce_*/stamp_* always new)
DROP FUNCTION IF EXISTS public.enforce_sample_file_path();
DROP FUNCTION IF EXISTS public.enforce_sample_files_max();
DROP FUNCTION IF EXISTS public.stamp_rights_on_submit();
DROP FUNCTION IF EXISTS public.enforce_submit_requirements();
DROP FUNCTION IF EXISTS public.enforce_sample_owner_edit_window();
DROP FUNCTION IF EXISTS public.enforce_sample_owner_insert();
DROP FUNCTION IF EXISTS public.enforce_owner_insert_draft_only();
DROP FUNCTION IF EXISTS public.enforce_samples_active_max();
DROP FUNCTION IF EXISTS public.enforce_freelancer_links_max();

-- is_admin / set_updated_at: only drop if no other dependents expected.
-- CAUTION: if is_admin or set_updated_at pre-existed and were left unchanged,
-- do NOT run the following two lines. Uncomment only when this migration created them.
-- DROP FUNCTION IF EXISTS public.set_updated_at();
-- DROP FUNCTION IF EXISTS public.is_admin();

-- Buckets are left in place (may contain objects). Remove manually if required:
-- delete from storage.buckets where id in ('sample-originals','sample-covers');
