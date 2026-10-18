drop table if exists public.ops_alert_dedupe;
drop table if exists public.email_queue;
drop table if exists public.order_events;

alter table public.projects drop column if exists tracking_token;
alter table public.projects drop column if exists idempotency_key;
alter table public.projects drop column if exists last_activity_at;
alter table public.projects drop column if exists delivered_at;
alter table public.projects drop column if exists revision_count;
alter table public.projects drop column if exists revision_limit;

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (
  status = any (array[
    'DRAFT'::text,
    'PAYMENT_PENDING'::text,
    'PAYMENT_CONFIRMED'::text,
    'READY_FOR_FULFILLMENT'::text,
    'ACTIVE'::text,
    'IN_PROGRESS'::text,
    'IN_REVIEW'::text,
    'COMPLETED'::text,
    'CANCELLED'::text,
    'PAST_DUE'::text,
    'EXPIRED'::text
  ])
);
