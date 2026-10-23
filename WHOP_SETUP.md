# Whop checkout integration

Whop is an additional checkout provider. Existing SpaceRemit and PayPal flows must remain unchanged.

## Required configuration

Add these as **server-only** Vercel environment variables (never prefix secrets with NEXT_PUBLIC_):

- `WHOP_API_KEY` — company-scoped API key with permission to create plans.
- `WHOP_COMPANY_ID` — Whop company ID (`biz_...`).
- `WHOP_PROJECT_PRODUCT_ID` — Whop product ID used for per-project one-time plans.
- `WHOP_LEAD_PACK_PRODUCT_ID` — Whop product ID used for per-purchase lead-pack plans.
- `WHOP_WEBHOOK_SECRET` — webhook signing secret from the Whop dashboard.

For subscriptions, configure pre-created Whop plan IDs for each paid DropVerse plan (monthly and annual) once the corresponding products and prices are set up in Whop.

## Rollout

1. Apply `supabase/migrations/20261023020000_whop_checkout_sessions.sql`.
2. Configure the environment variables above.
3. Configure the Whop webhook endpoint at `/api/whop/webhook` for successful payment events.
4. Run sandbox checkouts for success, cancellation, wrong amount, duplicate webhook delivery, and replayed webhook delivery.
5. Do not treat the checkout return URL or browser callback as proof of payment. Only the signed server webhook may mark a purchase paid.

Dynamic one-time project and lead-pack pricing uses a server-created hidden Whop plan, so prices are sourced and validated by DropVerse on the server rather than trusted from browser input.
