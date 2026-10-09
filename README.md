# DropVerse

Drop-servicing platform. Next.js 15 App Router, React 19, Tailwind CSS 3, Supabase, deployed on Vercel.

Live site: https://dropverse-nu.vercel.app

Intended custom domain: dropverse.js.org (added in Vercel, waiting on the js.org pull request and DNS).

## What is live

- Landing, pricing, login, earn, dashboard, admin, organizations, projects, invoices, referrals
- Supabase auth and Row Level Security
- SpaceRemit verification for project payments
- Privacy and Terms pages

## Local run

```bash
pnpm install
```

Copy `.env.example` to `.env.local` and set the public Supabase values. Server routes also need `SUPABASE_SERVICE_ROLE_KEY`. Do not commit secrets.

```bash
pnpm dev
```

Do not rerun the old `supabase/schema.sql` on the live project. The live database has newer migrations.

## Notes

- Landing samples are format previews, not published client work.
- Paid plan checkout is not live. Solo stays free.
- Admin pages are gated in `app/admin/layout.tsx` and again in `/api/admin/*`.
