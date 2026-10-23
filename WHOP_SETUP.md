# Whop checkout integration

Whop is an additional checkout provider. Existing SpaceRemit and PayPal flows must remain unchanged.

## Required configuration

Add these as **server-only** Vercel environment variables (never prefix secrets with NEXT_PUBLIC_):

- `WHOP_COMPANY_API_KEY` (or `WHOP_API_KEY`) — company API key with `plan:create`, `plan:basic:read`, `checkout_configuration:create`, `checkout_configuration:basic:read`, `access_pass:create`, `access_pass:update`, `payment:basic:read`, and `webhook_receive:payments` permissions.
- `WHOP_COMPANY_ID` — Whop company ID (`biz_...`).
- `WHOP_PROJECT_PRODUCT_ID` — Whop product ID used for per-project one-time plans.
- `WHOP_LEAD_PACK_PRODUCT_ID` — Whop product ID used for per-purchase lead-pack plans.
- `WHOP_WEBHOOK_SECRET` — webhook signing secret from the Whop dashboard.

For subscriptions, configure the pre-created monthly plan IDs in `NEXT_PUBLIC_WHOP_AGENCY_MONTHLY_PLAN_ID` and `NEXT_PUBLIC_WHOP_AGENCY_PRO_MONTHLY_PLAN_ID`. The server verifies each plan's recurring USD price against `lib/planConfig.ts` before starting checkout.

## Rollout

1. Apply `supabase/migrations/20261023020000_whop_checkout_sessions.sql` and `supabase/migrations/20261023020100_whop_confirm_lead_pack.sql`.
2. Configure the environment variables above.
3. Configure the Whop webhook endpoint at `/api/whop/webhook`, API version `v1`, and subscribe to `payment.succeeded`. The handler verifies the signature and retrieves the payment from Whop before fulfilling an order.
4. Run sandbox checkouts for success, cancellation, wrong amount, duplicate webhook delivery, and replayed webhook delivery.
5. Do not treat the checkout return URL or browser callback as proof of payment. Only the signed server webhook may mark a purchase paid. The embedded checkout must use the server-created checkout session ID; do not replace it with a raw browser-supplied plan ID.

Dynamic one-time project and lead-pack pricing uses a server-created hidden Whop plan, so prices are sourced and validated by DropVerse on the server rather than trusted from browser input.

**Subscription lifecycle limitation:** this branch upgrades the organization after a verified successful subscription checkout. Cancellation, refund, chargeback, and renewal-failure events are not yet synchronized back into DropVerse; do not enable Whop subscriptions for production customers until those lifecycle handlers are added and tested.
