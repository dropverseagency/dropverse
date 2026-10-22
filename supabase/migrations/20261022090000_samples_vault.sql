-- Samples Vault data model (v5)
-- Additive only. Does NOT modify profiles.role, protect_profile_role, or payouts.
-- Storage path: {owner_id}/{sample_id}/{filename}
-- Owner insert = draft only; pending_review only after file + cost + profile exist.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- freelancer_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.freelancer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  category text not null check (category in (
    'Video Editing', 'Graphic Design', 'Web Design', 'Social Media Content',
    'UGC Content', 'Copywriting', 'Branding', 'Motion Graphics'
  )),
  bio text not null default '' check (char_length(bio) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists freelancer_profiles_category_idx
  on public.freelancer_profiles (category);

drop trigger if exists trg_freelancer_profiles_updated_at on public.freelancer_profiles;
create trigger trg_freelancer_profiles_updated_at
  before update on public.freelancer_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- freelancer_links (not public via RLS; Phase 5 server route + service role)
-- ---------------------------------------------------------------------------
create table if not exists public.freelancer_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('behance', 'dribbble', 'upwork', 'other')),
  url text not null check (url ~* '^https://'),
  created_at timestamptz not null default now()
);

create index if not exists freelancer_links_user_idx
  on public.freelancer_links (user_id);

create or replace function public.enforce_freelancer_links_max()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.freelancer_links where user_id = new.user_id) >= 5 then
    raise exception 'MAX_LINKS: at most 5 portfolio links per freelancer';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freelancer_links_max on public.freelancer_links;
create trigger trg_freelancer_links_max
  before insert on public.freelancer_links
  for each row execute function public.enforce_freelancer_links_max();

-- ---------------------------------------------------------------------------
-- samples
-- ---------------------------------------------------------------------------
create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 120),
  slug text not null,
  category text not null check (category in (
    'Video Editing', 'Graphic Design', 'Web Design', 'Social Media Content',
    'UGC Content', 'Copywriting', 'Branding', 'Motion Graphics'
  )),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'draft' check (status in (
    'draft', 'pending_review', 'approved', 'rejected', 'unpublished'
  )),
  price_usd numeric(12, 2) null check (price_usd is null or price_usd >= 0),
  turnaround_days integer not null check (turnaround_days between 1 and 30),
  rights_attested_at timestamptz null,
  rights_terms_version text null,
  rejection_reason text null,
  reviewed_by uuid null references auth.users (id),
  reviewed_at timestamptz null,
  cover_path text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint samples_slug_unique unique (slug),
  constraint samples_rights_required check (
    status not in ('pending_review', 'approved')
    or rights_attested_at is not null
  )
);

create index if not exists samples_owner_idx on public.samples (owner_id);
create index if not exists samples_status_idx on public.samples (status);
create index if not exists samples_category_status_idx on public.samples (category, status);

drop trigger if exists trg_samples_updated_at on public.samples;
create trigger trg_samples_updated_at
  before update on public.samples
  for each row execute function public.set_updated_at();

create or replace function public.enforce_samples_active_max()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_count int;
begin
  if new.status = 'rejected' then
    return new;
  end if;
  select count(*) into active_count
  from public.samples
  where owner_id = new.owner_id
    and status <> 'rejected'
    and (tg_op = 'INSERT' or id is distinct from new.id);
  if active_count >= 3 then
    raise exception 'MAX_ACTIVE_SAMPLES: at most 3 non-rejected samples per freelancer';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_samples_active_max on public.samples;
create trigger trg_samples_active_max
  before insert or update of status, owner_id on public.samples
  for each row execute function public.enforce_samples_active_max();

create or replace function public.enforce_owner_insert_draft_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from 'draft' then
    raise exception 'FORBIDDEN: owner may only insert draft samples';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sample_owner_insert_draft on public.samples;
create trigger trg_sample_owner_insert_draft
  before insert on public.samples
  for each row execute function public.enforce_owner_insert_draft_only();

create or replace function public.enforce_sample_owner_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.owner_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN: owner_id must be the authenticated user';
  end if;

  if new.status is distinct from 'draft' then
    raise exception 'FORBIDDEN: owner may only insert draft samples';
  end if;

  new.price_usd := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.rejection_reason := null;

  return new;
end;
$$;

drop trigger if exists trg_sample_owner_insert on public.samples;
create trigger trg_sample_owner_insert
  before insert on public.samples
  for each row execute function public.enforce_sample_owner_insert();

create or replace function public.enforce_sample_owner_edit_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  if old.status not in ('draft', 'rejected') then
    raise exception 'FORBIDDEN: sample is locked while status is %', old.status;
  end if;

  if new.status not in ('draft', 'pending_review') then
    raise exception 'FORBIDDEN: owner may only set draft or pending_review';
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.price_usd is distinct from old.price_usd
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'FORBIDDEN: owner cannot change review or pricing fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sample_owner_edit on public.samples;
create trigger trg_sample_owner_edit
  before update on public.samples
  for each row execute function public.enforce_sample_owner_edit_window();

create or replace function public.enforce_submit_requirements()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.status = 'pending_review' and old.status is distinct from 'pending_review' then
    if not exists (select 1 from public.sample_files f where f.sample_id = new.id) then
      raise exception 'SUBMIT_REQUIRES_FILE: at least one file is required';
    end if;
    if not exists (select 1 from public.sample_costs c where c.sample_id = new.id) then
      raise exception 'SUBMIT_REQUIRES_COST: cost is required before submit';
    end if;
    if not exists (select 1 from public.freelancer_profiles fp where fp.user_id = new.owner_id) then
      raise exception 'SUBMIT_REQUIRES_PROFILE: complete your profile first';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_samples_submit_requirements on public.samples;
create trigger trg_samples_submit_requirements
  before update of status on public.samples
  for each row execute function public.enforce_submit_requirements();

create or replace function public.stamp_rights_on_submit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.status = 'pending_review'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending_review') then
    new.rights_attested_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_samples_stamp_rights on public.samples;
create trigger trg_samples_stamp_rights
  before insert or update of status on public.samples
  for each row execute function public.stamp_rights_on_submit();

-- ---------------------------------------------------------------------------
-- sample_costs (PRIVATE)
-- ---------------------------------------------------------------------------
create table if not exists public.sample_costs (
  sample_id uuid primary key references public.samples (id) on delete cascade,
  cost_usd numeric(12, 2) not null check (cost_usd >= 1 and cost_usd <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sample_costs_updated_at on public.sample_costs;
create trigger trg_sample_costs_updated_at
  before update on public.sample_costs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sample_files
-- ---------------------------------------------------------------------------
create table if not exists public.sample_files (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples (id) on delete cascade,
  kind text not null check (kind in ('image', 'pdf', 'video')),
  storage_path text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sample_files_sample_idx on public.sample_files (sample_id);

create or replace function public.enforce_sample_files_max()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.sample_files where sample_id = new.sample_id) >= 10 then
    raise exception 'MAX_FILES: at most 10 files per sample';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sample_files_max on public.sample_files;
create trigger trg_sample_files_max
  before insert on public.sample_files
  for each row execute function public.enforce_sample_files_max();

create or replace function public.enforce_sample_file_path()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  select s.owner_id into v_owner from public.samples s where s.id = new.sample_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'FORBIDDEN: sample not owned by caller';
  end if;

  if position('..' in new.storage_path) > 0
     or split_part(new.storage_path, '/', 1) <> v_owner::text
     or split_part(new.storage_path, '/', 2) <> new.sample_id::text
     or split_part(new.storage_path, '/', 3) = '' then
    raise exception 'FORBIDDEN: storage_path must be {owner_id}/{sample_id}/{filename}';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sample_file_path on public.sample_files;
create trigger trg_sample_file_path
  before insert or update of storage_path, sample_id on public.sample_files
  for each row execute function public.enforce_sample_file_path();

-- ---------------------------------------------------------------------------
-- sample_downloads
-- ---------------------------------------------------------------------------
create table if not exists public.sample_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sample_id uuid not null references public.samples (id) on delete cascade,
  file_id uuid not null references public.sample_files (id) on delete cascade,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists sample_downloads_user_day_idx
  on public.sample_downloads (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Public view
-- ---------------------------------------------------------------------------
drop view if exists public.samples_public;
create view public.samples_public
with (security_barrier = true)
as
select
  s.id,
  s.title,
  s.slug,
  s.category,
  s.description,
  s.price_usd,
  s.turnaround_days,
  s.cover_path,
  s.created_at,
  fp.display_name as freelancer_display_name,
  fp.category as freelancer_category
from public.samples s
left join public.freelancer_profiles fp on fp.user_id = s.owner_id
where s.status = 'approved';

grant select on public.samples_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.freelancer_profiles enable row level security;
alter table public.freelancer_links enable row level security;
alter table public.samples enable row level security;
alter table public.sample_costs enable row level security;
alter table public.sample_files enable row level security;
alter table public.sample_downloads enable row level security;

drop policy if exists "fp_select_own_or_admin" on public.freelancer_profiles;
create policy "fp_select_own_or_admin" on public.freelancer_profiles
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "fp_insert_own" on public.freelancer_profiles;
create policy "fp_insert_own" on public.freelancer_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "fp_update_own" on public.freelancer_profiles;
create policy "fp_update_own" on public.freelancer_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fp_admin_all" on public.freelancer_profiles;
create policy "fp_admin_all" on public.freelancer_profiles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "fl_select_owner_or_admin" on public.freelancer_links;
create policy "fl_select_owner_or_admin" on public.freelancer_links
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "fl_insert_own" on public.freelancer_links;
create policy "fl_insert_own" on public.freelancer_links
  for insert with check (auth.uid() = user_id);

drop policy if exists "fl_update_own" on public.freelancer_links;
create policy "fl_update_own" on public.freelancer_links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fl_delete_own" on public.freelancer_links;
create policy "fl_delete_own" on public.freelancer_links
  for delete using (auth.uid() = user_id);

drop policy if exists "fl_admin_all" on public.freelancer_links;
create policy "fl_admin_all" on public.freelancer_links
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "samples_select_owner_or_admin" on public.samples;
create policy "samples_select_owner_or_admin" on public.samples
  for select using (auth.uid() = owner_id or public.is_admin());

drop policy if exists "samples_insert_own" on public.samples;
create policy "samples_insert_own" on public.samples
  for insert with check (
    auth.uid() = owner_id
    and status = 'draft'
  );

drop policy if exists "samples_update_own_window" on public.samples;
create policy "samples_update_own_window" on public.samples
  for update using (
    (auth.uid() = owner_id and status in ('draft', 'rejected'))
    or public.is_admin()
  )
  with check (
    (auth.uid() = owner_id and status in ('draft', 'pending_review'))
    or public.is_admin()
  );

drop policy if exists "samples_admin_all" on public.samples;
create policy "samples_admin_all" on public.samples
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sc_select_owner_admin" on public.sample_costs;
create policy "sc_select_owner_admin" on public.sample_costs
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.samples s
      where s.id = sample_costs.sample_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "sc_insert_owner" on public.sample_costs;
create policy "sc_insert_owner" on public.sample_costs
  for insert with check (
    exists (
      select 1 from public.samples s
      where s.id = sample_id
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sc_update_owner" on public.sample_costs;
create policy "sc_update_owner" on public.sample_costs
  for update using (
    exists (
      select 1 from public.samples s
      where s.id = sample_costs.sample_id
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sc_admin_all" on public.sample_costs;
create policy "sc_admin_all" on public.sample_costs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sf_select_owner_admin" on public.sample_files;
create policy "sf_select_owner_admin" on public.sample_files
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.samples s
      where s.id = sample_files.sample_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "sf_insert_owner" on public.sample_files;
create policy "sf_insert_owner" on public.sample_files
  for insert with check (
    exists (
      select 1 from public.samples s
      where s.id = sample_id
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sf_delete_owner" on public.sample_files;
create policy "sf_delete_owner" on public.sample_files
  for delete using (
    exists (
      select 1 from public.samples s
      where s.id = sample_files.sample_id
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sf_admin_all" on public.sample_files;
create policy "sf_admin_all" on public.sample_files
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sd_select_own_or_admin" on public.sample_downloads;
create policy "sd_select_own_or_admin" on public.sample_downloads
  for select using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('sample-originals', 'sample-originals', false, 52428800),
  ('sample-covers', 'sample-covers', true, 15728640)
on conflict (id) do nothing;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'video/mp4', 'video/quicktime'
]
where id = 'sample-originals';

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'sample-covers';

drop policy if exists "sample_originals_owner_read" on storage.objects;
create policy "sample_originals_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sample-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "sample_originals_owner_write" on storage.objects;
create policy "sample_originals_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sample-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.samples s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sample_originals_owner_update" on storage.objects;
create policy "sample_originals_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'sample-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.samples s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sample_originals_owner_delete" on storage.objects;
create policy "sample_originals_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sample-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.samples s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sample_originals_admin_all" on storage.objects;
create policy "sample_originals_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'sample-originals' and public.is_admin())
  with check (bucket_id = 'sample-originals' and public.is_admin());

drop policy if exists "sample_covers_public_read" on storage.objects;
create policy "sample_covers_public_read" on storage.objects
  for select
  using (bucket_id = 'sample-covers');

drop policy if exists "sample_covers_owner_write" on storage.objects;
create policy "sample_covers_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sample-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.samples s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sample_covers_owner_update" on storage.objects;
create policy "sample_covers_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'sample-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.samples s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sample_covers_owner_delete" on storage.objects;
create policy "sample_covers_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sample-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.samples s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner_id = auth.uid()
        and s.status in ('draft', 'rejected')
    )
  );

drop policy if exists "sample_covers_admin_all" on storage.objects;
create policy "sample_covers_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'sample-covers' and public.is_admin())
  with check (bucket_id = 'sample-covers' and public.is_admin());
