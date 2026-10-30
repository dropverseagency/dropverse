-- Performance/security follow-up. No access predicates are broadened.
-- Move auth.uid() into scalar subqueries so it is evaluated once per statement.
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  clauses text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~* 'auth\.uid\(\)' AND qual !~* '\(\s*select\s+auth\.uid\(\)\s*\)')
        OR
        (with_check ~* 'auth\.uid\(\)' AND with_check !~* '\(\s*select\s+auth\.uid\(\)\s*\)')
      )
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;
    IF new_qual IS NOT NULL AND new_qual ~* 'auth\.uid\(\)' AND new_qual !~* '\(\s*select\s+auth\.uid\(\)\s*\)' THEN
      new_qual := regexp_replace(new_qual, 'auth\.uid\(\)', '(select auth.uid())', 'gi');
    END IF;
    IF new_check IS NOT NULL AND new_check ~* 'auth\.uid\(\)' AND new_check !~* '\(\s*select\s+auth\.uid\(\)\s*\)' THEN
      new_check := regexp_replace(new_check, 'auth\.uid\(\)', '(select auth.uid())', 'gi');
    END IF;
    clauses := '';
    IF new_qual IS NOT NULL THEN clauses := clauses || format(' USING (%s)', new_qual); END IF;
    IF new_check IS NOT NULL THEN clauses := clauses || format(' WITH CHECK (%s)', new_check); END IF;
    EXECUTE format('ALTER POLICY %I ON %I.%I%s', r.policyname, r.schemaname, r.tablename, clauses);
  END LOOP;
END
$$;

-- Retain the unique-constraint-backed index and one copy of the identical
-- partial unique index; these duplicates do not enforce any additional rule.
DROP INDEX IF EXISTS public.idx_referral_codes_code_unique;
DROP INDEX IF EXISTS public.idx_referrals_referred_user_unique;

-- Authenticated users retain their own-row SELECT policy; service-role admin
-- APIs continue to bypass RLS as intended.
DROP POLICY IF EXISTS "users read own payouts" ON public.payout_requests;

-- Explicitly deny browser roles access to server-managed tables with no
-- client-facing policies, keeping service_role access unchanged.
REVOKE ALL ON TABLE
  public.academy_waitlist,
  public.funnel_events,
  public.ops_alert_dedupe,
  public.page_views,
  public.payment_transaction_claims,
  public.project_client_tokens,
  public.rate_limit_buckets,
  public.site_presence
FROM PUBLIC, anon, authenticated;

-- Add indexes for foreign keys that lacked a suitable leading index.
CREATE INDEX IF NOT EXISTS "idx_academy_waitlist_user_id_fk" ON public."academy_waitlist" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_agency_custom_domains_landing_page_id_fk" ON public."agency_custom_domains" ("landing_page_id");
CREATE INDEX IF NOT EXISTS "idx_agency_custom_domains_organization_id_fk" ON public."agency_custom_domains" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_agency_landing_page_services_service_id_fk" ON public."agency_landing_page_services" ("service_id");
CREATE INDEX IF NOT EXISTS "idx_agency_landing_pages_created_by_fk" ON public."agency_landing_pages" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_agency_order_attributions_package_id_fk" ON public."agency_order_attributions" ("package_id");
CREATE INDEX IF NOT EXISTS "idx_agency_order_attributions_service_id_fk" ON public."agency_order_attributions" ("service_id");
CREATE INDEX IF NOT EXISTS "idx_commission_ledger_commission_id_fk" ON public."commission_ledger" ("commission_id");
CREATE INDEX IF NOT EXISTS "idx_email_queue_project_id_fk" ON public."email_queue" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_freelancer_verifications_reviewed_by_fk" ON public."freelancer_verifications" ("reviewed_by");
CREATE INDEX IF NOT EXISTS "idx_funnel_events_invoice_id_fk" ON public."funnel_events" ("invoice_id");
CREATE INDEX IF NOT EXISTS "idx_funnel_events_organization_id_fk" ON public."funnel_events" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_funnel_events_sample_id_fk" ON public."funnel_events" ("sample_id");
CREATE INDEX IF NOT EXISTS "idx_lead_packs_reviewed_by_fk" ON public."lead_packs" ("reviewed_by");
CREATE INDEX IF NOT EXISTS "idx_order_events_actor_id_fk" ON public."order_events" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_organization_invitations_invited_by_fk" ON public."organization_invitations" ("invited_by");
CREATE INDEX IF NOT EXISTS "idx_organizations_owner_id_fk" ON public."organizations" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_organizations_plan_fk" ON public."organizations" ("plan");
CREATE INDEX IF NOT EXISTS "idx_project_assignments_assigned_by_fk" ON public."project_assignments" ("assigned_by");
CREATE INDEX IF NOT EXISTS "idx_project_assignments_freelancer_id_fk" ON public."project_assignments" ("freelancer_id");
CREATE INDEX IF NOT EXISTS "idx_project_client_tokens_created_by_fk" ON public."project_client_tokens" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_project_deliveries_submitted_by_fk" ON public."project_deliveries" ("submitted_by");
CREATE INDEX IF NOT EXISTS "idx_project_disputes_opened_by_fk" ON public."project_disputes" ("opened_by");
CREATE INDEX IF NOT EXISTS "idx_project_disputes_project_id_fk" ON public."project_disputes" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_disputes_resolved_by_fk" ON public."project_disputes" ("resolved_by");
CREATE INDEX IF NOT EXISTS "idx_project_earnings_freelancer_id_fk" ON public."project_earnings" ("freelancer_id");
CREATE INDEX IF NOT EXISTS "idx_project_events_actor_id_fk" ON public."project_events" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_project_messages_author_id_fk" ON public."project_messages" ("author_id");
CREATE INDEX IF NOT EXISTS "idx_project_reviews_freelancer_id_fk" ON public."project_reviews" ("freelancer_id");
CREATE INDEX IF NOT EXISTS "idx_project_revision_requests_delivery_id_fk" ON public."project_revision_requests" ("delivery_id");
CREATE INDEX IF NOT EXISTS "idx_project_revision_requests_requested_by_fk" ON public."project_revision_requests" ("requested_by");
CREATE INDEX IF NOT EXISTS "idx_referrals_referral_code_id_fk" ON public."referrals" ("referral_code_id");
CREATE INDEX IF NOT EXISTS "idx_sample_addons_sample_id_fk" ON public."sample_addons" ("sample_id");
CREATE INDEX IF NOT EXISTS "idx_sample_downloads_file_id_fk" ON public."sample_downloads" ("file_id");
CREATE INDEX IF NOT EXISTS "idx_sample_downloads_sample_id_fk" ON public."sample_downloads" ("sample_id");
CREATE INDEX IF NOT EXISTS "idx_samples_backup_freelancer_id_fk" ON public."samples" ("backup_freelancer_id");
CREATE INDEX IF NOT EXISTS "idx_samples_reviewed_by_fk" ON public."samples" ("reviewed_by");
CREATE INDEX IF NOT EXISTS "idx_saved_samples_sample_id_fk" ON public."saved_samples" ("sample_id");
CREATE INDEX IF NOT EXISTS "idx_work_samples_freelancer_id_fk" ON public."work_samples" ("freelancer_id");
CREATE INDEX IF NOT EXISTS "idx_work_samples_service_id_fk" ON public."work_samples" ("service_id");
