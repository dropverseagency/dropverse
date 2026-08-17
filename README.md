# DropVerse V1

**Linking talent to sales.** A drop-servicing platform MVP built with Next.js 15 (App Router), Tailwind CSS v4, and Supabase.

## What is built so far

| Area | Status | Notes |
|---|---|---|
| Landing page | Live and public | Hero, advantage, how-it-works, 8 services, 3 work samples, CTA, footer |
| Login page | UI complete | Form scaffolded; Supabase auth calls land in the next incremental step |
| Dashboard | Static workspace | Stats and quick actions; session gating lands with the auth step |
| Services / samples | Static (8 / 3) | Data moves to Supabase in the next step |
| Database + RLS | Defined in `supabase/schema.sql` | 6 tables, new-user trigger, RLS on all tables, admin-write policies |
| Bookmark/save | Schema ready | `saved_samples` with unique user+sample constraint |
| SEO | Complete | Title/description, OpenGraph, Twitter card, robots indexable |

## Project structure

```
dropverse/
├── app/
│   ├── layout.tsx        # Root layout + SEO metadata
│   ├── globals.css       # DropVerse theme (dark green + gold)
│   ├── page.tsx          # Landing page
│   ├── login/page.tsx    # Auth UI (sign in / sign up)
│   └── dashboard/page.tsx
├── lib/
│   ├── types.ts          # Shared TypeScript models
│   └── supabase.ts       # Browser Supabase client (pending env vars)
├── supabase/schema.sql   # Tables, trigger, RLS policies, indexes
├── middleware.ts         # Protects /dashboard with an auth cookie
├── next.config.ts
├── .env.example          # Required environment variables
└── vercel.json
```

## Tech stack

- **Framework:** Next.js 15 (App Router, static prerendering) + React 19
- **Styling:** Tailwind CSS v4, custom dark-green + gold DropVerse theme, Manrope display font
- **Database + Auth:** Supabase (Postgres, Row Level Security, GoTrue auth) — schema defined, client pending env vars
- **Hosting:** Vercel (connected GitHub repo, auto-deploys `main`)
- **Language:** TypeScript

## Environment variables (required next step)

Create a `.env.local` locally and add the same keys in the Vercel dashboard
(`Settings → Environment Variables`) for Production and Preview:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project API settings |

After adding the keys, run `supabase/schema.sql` in the Supabase SQL Editor to
create all tables, the new-user trigger, RLS policies, and indexes.

## Deployment

- GitHub repo: `dropverseagency/dropverse` → Vercel auto-deploys on push to `main`.
- Production URL: `dropverse-5luyw43bf-creator-of-verses.vercel.app` (Vercel SSO
  protection was disabled via API on 2026-08-17 so the site is publicly reachable).
- Build command: `next build` — currently passes with zero errors.

## Remaining issues and next steps

1. **Wire Supabase into the login form** (`lib/supabase.ts` is scaffolded): sign in/up, session cookies, and role-based redirect to `/dashboard`.
2. **Seed real data** into categories/services/freelancers/work_samples and build the Services, Work Samples, and Freelancer Profile pages against the DB.
3. **Implement save/bookmark UI** on sample cards using the `saved_samples` table.
4. **Admin dashboard** — the RLS admin policies are ready; build the content-management UI next.
5. Custom domain + favicon/OG image assets.

## Quality check (2026-08-17)

Verified: landing page renders publicly (HTTP 200), all nav links resolve,
build passes, RLS policies audited, invalid Tailwind classes fixed, SEO
metadata added, middleware for protected routes added, SSO wall removed.
