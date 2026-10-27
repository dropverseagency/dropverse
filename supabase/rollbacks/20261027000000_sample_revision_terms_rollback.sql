begin;

alter table public.projects
  drop column if exists revision_price_usd;

alter table public.samples
  drop column if exists revision_price_usd;

alter table public.samples
  drop column if exists revision_limit;

commit;
