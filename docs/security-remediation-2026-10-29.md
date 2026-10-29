# DropVerse security remediation — 2026-10-29

## Included in this branch
- Project creation now uses the server-side service client and ignores client-supplied SpaceRemit payment IDs.
- Database guards reject direct client project creation, financial/payment/lifecycle mutations, invoice writes, payout writes, and audit-log writes.
- Internal trigger-guard functions are not callable as public or authenticated PostgREST RPCs; only the trusted service role can execute them.
- Payout creation remains on the existing atomic reservation RPC.
- Adds an atomic Supabase rate-limit RPC with stale-bucket cleanup; app code prefers atomic Upstash or Supabase and falls back to a bounded local limiter instead of unconditional success.
- Verified SpaceRemit transactions are claimed atomically so a transaction ID cannot be replayed against a different project or invoice.
- SpaceRemit verification requires a completed transaction and matching amount/currency; callback updates use compare-and-set.
- Invoice payment uses compare-and-set, validates completed SpaceRemit status, and binds invoice consent to invoice ID, amount, and currency.
- Turnstile rejects provider/network failures when configured.

## Production rollout status
- Applied to Supabase production:
  - `20261029221840_security_remediation_20261029`
  - `20261029222038_revoke_trigger_function_rpc`
- The matching application changes are still on PR #65 and have not yet been promoted to the production website.
- The branch CI now applies both migrations to a disposable PostgreSQL database and tests blocked direct writes, allowed non-financial project edits, protected payment-state updates, payment-transaction replay rejection, and atomic rate limiting.

## Remaining configuration and repository work
1. Configure a matching Cloudflare Turnstile site key and `TURNSTILE_SECRET_KEY` before making Turnstile mandatory on public forms. No secrets belong in Git.
2. Supabase Auth still reports leaked-password protection disabled; enable it in the Supabase Auth security settings.
3. The `DODO_*` Vercel environment variables remain configured but are not used by the current payment routes. The available Vercel connector does not expose an environment-variable delete action.
4. Recover the five historical migrations missing from Git from verified SQL/schema history; do not add no-op placeholders.
5. CSP remains report-only until browser-level reports and preview behavior are checked. Enabling enforcement blindly may break hydration or checkout.
6. Supabase's performance advisor still reports 41 unindexed foreign keys; these are performance improvements to plan separately after the security rollout.

## Safety notes
- No real payment was initiated during verification.
- Preview smoke checks returned HTTP 200 for public pages and HTTP 405 for GET requests to POST-only payment APIs, with HSTS, `nosniff`, and `X-Frame-Options: DENY` present.
