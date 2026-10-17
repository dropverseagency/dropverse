# DropVerse

Next.js 15 app for DropVerse (workspace + agency storefronts).

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Auth security (important)

The login form calls `POST /api/auth/guard` (rate limit + optional Cloudflare Turnstile) **before** `supabase.auth.signInWithPassword` / `signUp`.

A browser client can still call Supabase Auth APIs directly, so **also enable server-side protection in Supabase**:

1. **Authentication → Attack Protection → CAPTCHA** — Cloudflare Turnstile (same keys as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`).
2. Keep Supabase built-in auth rate limits enabled.
3. The app passes `captchaToken` into `signInWithPassword` / `signUp` when a token is present.

## Database: profiles.role (urgent)

Live RLS previously allowed any authenticated user to `update profiles set role = 'admin'` on their own row (UPDATE policies OR together).

**Apply on production after a backup — this is database-only and should land BEFORE relying on the app merge:**

1. `supabase/migrations/20261017090000_protect_profiles_role.sql`
2. Run checks in `supabase/tests/profiles_role_protection.sql`
3. Then optional `20261017090100_rate_limit_buckets.sql`

Rollback: `supabase/rollbacks/20261017090000_protect_profiles_role_rollback.sql` (restores the old insecure policies — emergency only).

`handle_new_user` inserts without `role` (column default `'user'`). Client profile upserts must never send `role`. Admin role changes use the service role after `requireAdmin()`.

## Payments

SpaceRemit (local). Paddle and Dodo routes return HTTP 410.

## Rate limiting

Order: Upstash → `rate_limit_buckets` table (service role) → in-memory fail-open.

## CSP

Default Report-Only. Set `CSP_ENFORCE=true` after testing. Violations → `/api/csp-report`.

## Env

See `.env.example`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
