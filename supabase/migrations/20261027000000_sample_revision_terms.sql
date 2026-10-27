begin;

alter table public.samples
  add column if not exists revision_limit integer not null default 2
  check (revision_limit between 0 and 5);

alter table public.samples
  add column if not exists revision_price_usd numeric(10,2) not null default 25
  check (revision_price_usd between 5 and 200);

alter table public.projects
  add column if not exists revision_price_usd numeric(10,2) null
  check (revision_price_usd is null or revision_price_usd between 5 and 200);

commit;
