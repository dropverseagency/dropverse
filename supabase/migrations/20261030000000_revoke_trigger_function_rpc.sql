-- Keep internal trigger guards out of the exposed PostgREST RPC surface.
begin;
revoke all on function public.guard_project_financial_mutations() from public, anon, authenticated;
revoke all on function public.guard_invoice_mutations() from public, anon, authenticated;
commit;
