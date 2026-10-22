-- Destructive rollback for Samples Vault v5
-- storage.objects under sample-originals / sample-covers are NOT deleted
-- automatically — remove manually if a full rollback is needed.

drop policy if exists "sample_covers_admin_all" on storage.objects;
drop policy if exists "sample_covers_owner_delete" on storage.objects;
drop policy if exists "sample_covers_owner_update" on storage.objects;
drop policy if exists "sample_covers_owner_write" on storage.objects;
drop policy if exists "sample_covers_public_read" on storage.objects;
drop policy if exists "sample_originals_admin_all" on storage.objects;
drop policy if exists "sample_originals_owner_delete" on storage.objects;
drop policy if exists "sample_originals_owner_update" on storage.objects;
drop policy if exists "sample_originals_owner_write" on storage.objects;
drop policy if exists "sample_originals_owner_read" on storage.objects;

drop view if exists public.samples_public;

drop table if exists public.sample_downloads;
drop table if exists public.sample_files;
drop table if exists public.sample_costs;
drop table if exists public.samples;
drop table if exists public.freelancer_links;
drop table if exists public.freelancer_profiles;

drop function if exists public.enforce_sample_file_path();
drop function if exists public.enforce_sample_files_max();
drop function if exists public.stamp_rights_on_submit();
drop function if exists public.enforce_submit_requirements();
drop function if exists public.enforce_sample_owner_edit_window();
drop function if exists public.enforce_sample_owner_insert();
drop function if exists public.enforce_owner_insert_draft_only();
drop function if exists public.enforce_samples_active_max();
drop function if exists public.enforce_freelancer_links_max();
drop function if exists public.set_updated_at();
drop function if exists public.is_admin();
