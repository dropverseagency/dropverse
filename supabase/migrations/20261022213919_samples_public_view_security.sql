-- Harden Samples Vault public catalogue: invoker view + least-privilege access.
-- The public view may expose only approved sample metadata and the associated
-- public freelancer display name/category. All writes remain server-side.
drop policy if exists samples_public_approved_read on public.samples;
create policy samples_public_approved_read on public.samples
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists fp_public_approved_sample_read on public.freelancer_profiles;
create policy fp_public_approved_sample_read on public.freelancer_profiles
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.samples s
      where s.owner_id = freelancer_profiles.user_id
        and s.status = 'approved'
    )
  );

revoke all privileges on table public.samples from anon, authenticated;
revoke all privileges on table public.freelancer_profiles from anon, authenticated;

grant select (id, owner_id, status, title, slug, category, description, price_usd, turnaround_days, cover_path, created_at)
  on table public.samples to anon, authenticated;
grant select (user_id, display_name, category)
  on table public.freelancer_profiles to anon, authenticated;

alter view public.samples_public set (security_invoker = true);
grant select on public.samples_public to anon, authenticated;
