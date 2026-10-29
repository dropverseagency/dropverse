# DropVerse security remediation — 2026-10-29

## Included in this branch
- Project creation now uses the server-side service client and ignores client-supplied SpaceRemit payment IDs.
- Database guards reject direct client project creation, financial/payment/lifecycle mutations, invoice writes, payout writes, and audit-log writes.
- Payout creation remains on the existing atomic reservation RPC.
- Adds an atomic Supabase rate-limit RPC; app code prefers atomic Upstash or Supabase and falls back to a bounded local limiter instead of unconditional success.
- Turnstile rejects provider/network failures when configured.
- SpaceRemit callbacks compare verified amount and currency against the pending project/invoice before confirmation.
- Invoice payment uses compare-and-set, and invoice consent is bound to invoice ID, amount, and currency.

## Rollout requirements
1. Review this branch and run CI/build on a Vercel Preview.
2. Apply `supabase/migrations/20261029000000_security_remediation.sql` before deploying app code.
3. Configure a matching Cloudflare Turnstile site key and `TURNSTILE_SECRET_KEY` before making Turnstile mandatory on public forms. No secrets belong in Git.
4. Upstash `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are optional with the new Supabase RPC; a shared backend is required for robust cross-instance rate limiting.
5. Remove obsolete `DODO_*` Vercel variables only after confirming no active deployment/environment depends on them. This branch does not change live Vercel settings.
6. Recover the five historical migrations missing from Git from verified SQL/schema history; do not add no-op placeholders.
7. CSP remains report-only until reports and preview behavior are checked. Enabling enforcement blindly may break hydration or checkout.

## Production safety
No production migration was applied, no production environment variable was changed, and no production deployment was triggered by this branch commit.
