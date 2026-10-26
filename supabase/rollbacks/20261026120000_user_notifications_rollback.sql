begin;
drop policy if exists "user_notifications_update_own" on public.user_notifications;
drop policy if exists "user_notifications_select_own" on public.user_notifications;
drop table if exists public.user_notifications;
commit;
