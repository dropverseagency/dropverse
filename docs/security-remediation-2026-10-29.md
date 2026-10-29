# DropVerse security remediation — 2026-10-29

## Implemented and deployed
- Project creation uses the server-side service client and ignores client-supplied SpaceRemit payment IDs.
- Database guards reject direct client project creation, financial/payment/lifecycle mutations, invoice writes, payout writes, and audit-log writes.
- Internal trigger-guard functions are not callable as public or authenticated PostgREST RPCs; only the trusted service role can execute them.
- Payout creation remains on the existing atomic reservation RPC.
- Adds an atomic Supabase rate-limit RPC with stale-bucket cleanup; app code prefers atomic Upstash or Supabase and falls back to a bounded local limiter.
- Verified SpaceRemit transactions are claimed atomically so a transaction ID cannot be replayed against a different project or invoice.
- SpaceRemit verification requires a completed transaction and matching amount/currency; callback updates use compare-and-set.
- Invoice payment uses compare-and-set, validates completed SpaceRemit status, and binds invoice consent to invoice ID, amount, and currency.
- Turnstile rejects provider/network failures when configured.
- The five previously missing historical migration files were restored from the exact `statements` recorded in production's `supabase_migrations.schema_migrations` ledger.

## Production rollout status
- Applied to Supabase production:
  - `20261029221840_security_remediation_20261029`
  - `20261029222038_revoke_trigger_function_rpc`
- PR #65 was merged and the matching application build was deployed to Vercel production.
- Smoke checks on `dropverse10v.vercel.app`: public pages returned HTTP 200; GET requests to POST-only payment APIs returned HTTP 405; HSTS, `nosniff`, and `X-Frame-Options: DENY` were present.
- No Vercel runtime error clusters were found in the five-minute post-deploy window; no real payment was initiated.

## Remaining configuration work
1. Configure a matching Cloudflare Turnstile site key and `TURNSTILE_SECRET_KEY` before making Turnstile mandatory on public forms. No secrets belong in Git.
2. Supabase Auth still reports leaked-password protection disabled; enable it in the Supabase Auth security settings.
3. The `DODO_*` Vercel environment variables remain configured but are not used by current payment routes. The available Vercel connector does not expose an environment-variable delete action.
4. CSP remains report-only until browser-level reports and preview behavior are checked. Enabling enforcement blindly may break hydration or checkout.
5. Supabase's performance advisor still reports 41 unindexed foreign keys; address these separately after the security rollout.
