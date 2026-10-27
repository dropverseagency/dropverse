-- Sellable samples, verified freelancer trust, agency branding and funnel analytics.

alter table public.samples
  add column if not exists revision_limit integer not null default 2 check (revision_limit between 0 and 5),
  add column if not exists revision_price_usd numeric(10,2) not null default 25 check (revision_price_usd between 5 and 200),
  add column if not exists scope text not null default '' check (char_length(scope) <= 3000),
  add column if not exists deliverables text not null default '' check (char_length(deliverables) <= 2000),
  add column if not exists client_requirements text not null default '' check (char_length(client_requirements) <= 2000),
  add column if not exists minimum_resale_price_usd numeric(12,2) check (minimum_resale_price_usd is null or minimum_resale_price_usd >= 0),
  add column if not exists sla_response_hours integer not null default 24 check (sla_response_hours between 1 and 168),
  add column if not exists sla_delivery_days integer check (sla_delivery_days between 1 and 90),
  add column if not exists service_importance text not null default 'standard' check (service_importance in ('standard','important','critical')),
  add column if not exists backup_freelancer_id uuid references auth.users(id) on delete set null;

create table if not exists public.sample_addons (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  price_usd numeric(12,2) not null check (price_usd >= 0),
  extra_days integer not null default 0 check (extra_days between 0 and 30),
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.freelancer_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  identity_status text not null default 'unsubmitted' check (identity_status in ('unsubmitted','pending','verified','rejected','expired')),
  specialty_status text not null default 'unreviewed' check (specialty_status in ('unreviewed','pending','passed','failed')),
  specialty_review_note text,
  verified_level text not null default 'none' check (verified_level in ('none','identity','specialist','pro')),
  identity_provider_reference text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  freelancer_id uuid not null references auth.users(id) on delete restrict,
  reviewer_kind text not null check (reviewer_kind in ('client','seller')),
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.freelancer_metrics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paid_completed_projects integer not null default 0,
  on_time_delivery_rate numeric(5,2),
  completion_rate numeric(5,2),
  average_response_minutes numeric(12,2),
  dispute_rate numeric(5,2),
  average_rating numeric(3,2),
  rating_count integer not null default 0,
  calculated_at timestamptz not null default now()
);

create table if not exists public.agency_custom_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  landing_page_id uuid not null references public.agency_landing_pages(id) on delete cascade,
  hostname text not null unique check (hostname = lower(hostname)),
  status text not null default 'pending' check (status in ('pending','verified','failed','disabled')),
  verification_token_hash text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create or replace view public.agency_custom_domain_routes as select d.hostname,p.slug from public.agency_custom_domains d join public.agency_landing_pages p on p.id=d.landing_page_id where d.status='verified' and p.published=true;
grant select on public.agency_custom_domain_routes to anon,authenticated;

alter table public.agency_landing_pages
  add column if not exists email_from_name text,
  add column if not exists email_reply_to text,
  add column if not exists invoice_footer text,
  add column if not exists whatsapp_updates_enabled boolean not null default false;

alter table public.profiles add column if not exists whatsapp_updates_opt_in boolean not null default false;

alter table public.agency_order_attributions
  add column if not exists scope_accepted boolean not null default false,
  add column if not exists revision_terms_accepted boolean not null default false,
  add column if not exists accepted_at timestamptz;

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('visit','sign_up','profile_complete','sample_viewed','project_created','invoice_sent','payment_completed','freelancer_assigned','delivered','approved','payout_completed','repeat_project','support_interaction')),
  anonymous_id text,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  sample_id uuid references public.samples(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount_usd numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists funnel_events_name_time_idx on public.funnel_events(event_name, occurred_at desc);
create index if not exists funnel_events_user_time_idx on public.funnel_events(user_id, occurred_at desc);
create index if not exists funnel_events_project_idx on public.funnel_events(project_id);

alter table public.sample_addons enable row level security;
alter table public.freelancer_verifications enable row level security;
alter table public.project_reviews enable row level security;
alter table public.freelancer_metrics enable row level security;
alter table public.agency_custom_domains enable row level security;
alter table public.funnel_events enable row level security;

create policy "public reads active sample addons" on public.sample_addons for select using (active and exists(select 1 from public.samples s where s.id=sample_id and s.status='approved'));
create policy "freelancer reads own verification" on public.freelancer_verifications for select using (user_id=auth.uid());
create policy "public reads freelancer metrics" on public.freelancer_metrics for select using (true);
create policy "public reads paid project reviews" on public.project_reviews for select using (exists(select 1 from public.projects p where p.id=project_id and p.payment_status='PAYMENT_CONFIRMED' and p.operations_status='approved'));

create or replace function public.refresh_freelancer_metrics(p_user_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_total int; v_completed int; v_on_time int; v_disputes int; v_response numeric; v_rating numeric; v_ratings int;
begin
  select count(*), count(*) filter(where operations_status='approved'),
    count(*) filter(where operations_status='approved' and (delivery_due_at is null or exists(select 1 from project_events e where e.project_id=projects.id and e.event_type='delivery_submitted' and e.created_at<=projects.delivery_due_at))),
    count(*) filter(where operations_status='disputed')
  into v_total,v_completed,v_on_time,v_disputes from projects where assigned_freelancer_id=p_user_id and payment_status='PAYMENT_CONFIRMED';
  select avg(extract(epoch from (a.responded_at-a.offered_at))/60) into v_response from project_assignments a where a.freelancer_id=p_user_id and a.responded_at is not null;
  select avg(rating),count(*) into v_rating,v_ratings from project_reviews where freelancer_id=p_user_id;
  insert into freelancer_metrics(user_id,paid_completed_projects,on_time_delivery_rate,completion_rate,average_response_minutes,dispute_rate,average_rating,rating_count,calculated_at)
  values(p_user_id,v_completed,case when v_completed>0 then round(v_on_time*100.0/v_completed,2) end,case when v_total>0 then round(v_completed*100.0/v_total,2) end,v_response,case when v_total>0 then round(v_disputes*100.0/v_total,2) end,v_rating,v_ratings,now())
  on conflict(user_id) do update set paid_completed_projects=excluded.paid_completed_projects,on_time_delivery_rate=excluded.on_time_delivery_rate,completion_rate=excluded.completion_rate,average_response_minutes=excluded.average_response_minutes,dispute_rate=excluded.dispute_rate,average_rating=excluded.average_rating,rating_count=excluded.rating_count,calculated_at=now();
end $$;
revoke all on function public.refresh_freelancer_metrics(uuid) from public,anon,authenticated;
grant execute on function public.refresh_freelancer_metrics(uuid) to service_role;

create or replace view public.sample_sellable_catalog as
select s.id,s.slug,s.title,s.category,s.description,s.scope,s.deliverables,s.client_requirements,s.price_usd,s.minimum_resale_price_usd,s.turnaround_days,s.revision_limit,s.revision_price_usd,s.sla_response_hours,s.sla_delivery_days,s.service_importance,s.cover_path,s.owner_id,
fp.display_name freelancer_display_name,coalesce(fa.available,true) freelancer_available,fa.next_available_at,fv.verified_level,fm.on_time_delivery_rate,fm.completion_rate,fm.average_response_minutes,fm.dispute_rate,fm.average_rating,fm.rating_count
from public.samples s join public.freelancer_profiles fp on fp.user_id=s.owner_id
left join public.freelancer_availability fa on fa.user_id=s.owner_id left join public.freelancer_verifications fv on fv.user_id=s.owner_id left join public.freelancer_metrics fm on fm.user_id=s.owner_id
where s.status='approved';
grant select on public.sample_sellable_catalog to anon,authenticated;
