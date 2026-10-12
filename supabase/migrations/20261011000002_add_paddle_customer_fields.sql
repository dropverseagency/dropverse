alter table public.paddle_orders
  add column if not exists customer_id text,
  add column if not exists subscription_id text;

create index if not exists idx_paddle_orders_customer on public.paddle_orders(customer_id);
create index if not exists idx_paddle_orders_subscription on public.paddle_orders(subscription_id);
