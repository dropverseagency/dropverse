alter table public.paddle_orders
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists plan_id text;

create index if not exists idx_paddle_orders_organization on public.paddle_orders(organization_id);
create index if not exists idx_paddle_orders_plan on public.paddle_orders(plan_id);
