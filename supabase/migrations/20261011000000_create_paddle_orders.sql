-- Paddle orders created from public work sample checkout.
create table if not exists public.paddle_orders (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  event_id text unique,
  sample_id uuid references public.work_samples(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  status text not null default 'draft',
  amount numeric not null check (amount > 0),
  currency_code text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_paddle_orders_sample on public.paddle_orders(sample_id);
create index if not exists idx_paddle_orders_user on public.paddle_orders(user_id);
create index if not exists idx_paddle_orders_status on public.paddle_orders(status);

alter table public.paddle_orders enable row level security;

create policy "paddle orders owner read" on public.paddle_orders
  for select using (user_id = auth.uid());

create or replace function public.paddle_orders_update_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists paddle_orders_biu on public.paddle_orders;
create trigger paddle_orders_biu
  before update on public.paddle_orders
  for each row execute function public.paddle_orders_update_timestamp();
