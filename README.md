# DropVerse

Next.js 15 app for DropVerse (workspace + agency storefronts).

## Setup

```bash
pnpm install
cp .env.example .env.local
# fill Supabase + SpaceRemit values
pnpm dev
```

Server routes need `SUPABASE_SERVICE_ROLE_KEY` (never expose to the browser).

Payments: SpaceRemit (local). Paddle and Dodo checkout routes are disabled (HTTP 410).

See `.env.example` for the full list of environment variables.
