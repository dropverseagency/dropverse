# DropVerse

B2B workspace platform for digital teams.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase, Vercel.

## Security notes

- Profiles role is protected by RLS + `protect_profile_role` trigger (users cannot self-elevate to admin).
- Auth forms should call `POST /api/auth/guard` before Supabase sign-in/sign-up (rate limit + optional Turnstile).
- Dodo and Paddle payment routes return 410 / are disabled. Active payments use SpaceRemit.
- Optional server-side CAPTCHA: enable Cloudflare Turnstile in Supabase Authentication > Attack Protection and pass `captchaToken` from the client.

## Ops

- `GET /api/health` — Supabase connectivity probe (`{ status, checks, time }`). Returns 200 or 503. No secrets.
- Rate limiting: Upstash → `rate_limit_buckets` table → in-memory fail-open. See `lib/rateLimit.ts`.
- Profiles: `protect_profile_role` trigger blocks user role changes (migration `20261017090000_protect_profiles_role.sql`).
