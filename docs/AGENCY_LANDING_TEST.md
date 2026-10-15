# Agency Landing Pages — Safe Test Checklist

**Do not apply the migration to production until this checklist passes on a test Supabase project.**

## Prerequisites
1. Branch: `feature/agency-landing`
2. Apply `supabase/migrations/20261015010000_agency_landing_pages.sql` on a **test** project only
3. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. Optional payments: `NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY`, `SPACEREMIT_PRIVATE_KEY` (real keys only after provider verification)

## Seed data
1. Admin → Services: ensure at least one **active** service exists
2. Admin → Packages: create 1–2 packages with retail price > 0 for that service
3. Set a test organization `plan` to `AGENCY`, `AGENCY_PRO`, or `ENTERPRISE`
4. Ensure the test user is `organization_members.role` = `OWNER` or `ADMIN` with `status` = `active`

## Agency flow
1. Sign in → dashboard should show **Agency landing page** entry (eligible plans only)
2. Open `/dashboard/landing`
3. Set display name, slug, headline; select services; **Save**
4. **Publish** → open `/a/{slug}` in a private window
5. Confirm services and package prices render (retail only; no fulfillment cost)
6. Submit an order with a unique email

## Order / payment expectations
- A `projects` row is created with `payment_status = PAYMENT_PENDING`
- An `agency_order_attributions` row links project → org → landing page (retail only)
- Agency **Landing page orders** list shows the order (retail, no costs)
- Admin → Agency pages shows the page and recent order
- If SpaceRemit public key is **missing**: order still created; UI says DropVerse will contact the customer; payment_method is `CLIENT_PAYS_DROPVERSE`
- If SpaceRemit keys are **present**: widget can run; confirm API matches **retail** `client_price`, not fulfillment cost

## Negative checks
- Org on SOLO/TEAM plan: `/dashboard/landing` shows upgrade; APIs return `PLAN_REQUIRED`
- Unpublished page: `/a/{slug}` → not found
- Package not linked to page services: order API rejects
- Repeat same `Idempotency-Key`: returns same `projectId`, no duplicate attribution

## Rollback (test DB only)
```sql
DROP TABLE IF EXISTS public.agency_order_attributions;
DROP TABLE IF EXISTS public.agency_landing_page_services;
DROP TABLE IF EXISTS public.agency_landing_pages;
DROP TABLE IF EXISTS public.service_packages;
```
