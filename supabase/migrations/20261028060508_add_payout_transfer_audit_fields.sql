-- Store manual payout processing evidence for auditability.
begin;
alter table public.payout_requests
  add column if not exists transfer_reference text,
  add column if not exists admin_note text;
alter table public.payout_requests
  drop constraint if exists payout_requests_transfer_reference_length_check;
alter table public.payout_requests
  add constraint payout_requests_transfer_reference_length_check
  check (transfer_reference is null or length(transfer_reference) <= 200);
alter table public.payout_requests
  drop constraint if exists payout_requests_admin_note_length_check;
alter table public.payout_requests
  add constraint payout_requests_admin_note_length_check
  check (admin_note is null or length(admin_note) <= 2000);
commit;
