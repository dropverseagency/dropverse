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

1. **Authentication → Attack Protection → CAPTCHA**  
   Provider: Cloudflare Turnstile  
   Use the same site/secret keys as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`.
2. Keep Supabase’s built-in auth rate limits enabled.
3. When Supabase CAPTCHA is on, the app passes `captchaToken` into `signInWithPassword` / `signUp` options.

## Payments

SpaceRemit (local). Paddle and Dodo routes return HTTP 410.

## Rate limiting

Order: Upstash → `rate_limit_buckets` table (service role) → in-memory fail-open.

Apply migrations under `supabase/migrations/` in order when ready (app boots without them).

## CSP

Default **Report-Only**. Set `CSP_ENFORCE=true` on Vercel after testing. Violations post to `/api/csp-report` (structured logs only).

## Env

See `.env.example`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
