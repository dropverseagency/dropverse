-- The payout summary includes user-specific financial data and must only be callable by the server service role.
begin;
revoke all on function public.get_payout_balance_summary(uuid) from public;
revoke all on function public.get_payout_balance_summary(uuid) from anon;
revoke all on function public.get_payout_balance_summary(uuid) from authenticated;
grant execute on function public.get_payout_balance_summary(uuid) to service_role;
commit;
