# DropVerse release QA checklist

**Scope:** account recovery, mobile onboarding, public SEO/legal pages, lead marketplace checkout, and financial consistency.
**Safety:** use a preview deployment and payment-provider sandbox/test credentials only. Do not send real payments, execute payouts, enable payout methods, send Telegram/customer notifications, or apply the migration to production as part of this checklist.

## 1. Account recovery
- [ ] Open `/login` at 360px, 390px, tablet, and desktop widths; verify the “Forgot password?” link is visible only in login mode.
- [ ] Submit a valid email to `/forgot-password`; UI response must not reveal whether the account exists.
- [ ] Submit an invalid email format; browser validation should block it.
- [ ] Use a valid test account’s reset email and follow the link to `/reset-password`.
- [ ] Verify an expired/invalid link shows a safe error and a route to request a new link.
- [ ] Submit a password shorter than 8 characters and mismatched passwords; both must be rejected.
- [ ] Set a new password, sign in with it, and verify the old password no longer works.
- [ ] Verify the reset email redirect URL is allowed in Supabase Auth URL Configuration for the preview host and production host before release.

## 2. Signup, onboarding, and mobile navigation
- [ ] Test signup with email confirmation enabled and disabled, and confirm referral code survives the flow.
- [ ] Test the three user types and freelancer details; required profile fields should lead to onboarding when incomplete.
- [ ] Confirm the mobile navigation opens/closes with touch, closes with Escape, and does not trap focus.
- [ ] Confirm inputs, checkboxes, buttons, error text, and lead checkout fields fit a 320–390px viewport without horizontal overflow.
- [ ] Verify loading, empty, error, and success states for login, onboarding, purchases, and dashboard routes.
- [ ] Verify unauthenticated users can browse the public lead catalogue but are redirected to login to buy or sell.

## 3. Lead Marketplace — use isolated test accounts and test data
- [ ] Seller cannot buy their own pack.
- [ ] Draft, pending-review, rejected, and suspended packs are not publicly discoverable or purchasable.
- [ ] A pack's effective cap is the lower of seller max and admin max; default seller cap remains 10 unless configured lower.
- [ ] Start two simultaneous checkout requests when one seat remains. Exactly one reservation should succeed.
- [ ] A pending checkout reserves a seat for 30 minutes; an expired reservation can be released and a new checkout created.
- [ ] Repeating checkout for the same buyer and active pack returns the same pending purchase rather than creating a duplicate.
- [ ] Two simultaneous confirmations cannot exceed the seat cap or create duplicate seller ledger credits.
- [ ] Duplicate payment IDs are rejected.
- [ ] A late successful payment after the reservation expires and the cap fills must surface manual review/refund messaging, not grant a download or silently oversell.
- [ ] The public catalogue and detail API never return private storage paths.
- [ ] A non-owner or unpaid buyer cannot obtain a signed file URL. A paid buyer can obtain a short-lived URL.
- [ ] The seller ledger uses a 20% DropVerse platform commission for new completed sales and records seller net exactly once.
- [ ] Verify seller data-rights attestation and resale-rights acknowledgement are required and manual admin approval remains in place.

## 4. Payment and accounting integration
- [ ] Use only provider sandbox/test mode. Confirm the provider payment lookup is server-side and checks successful response, USD currency, and exact expected amount.
- [ ] Test declined/cancelled payment, missing provider keys, provider timeout/invalid JSON, amount mismatch, currency mismatch, duplicate confirmation, and concurrent confirmation.
- [ ] Verify a failed or unverified payment leaves the purchase pending and does not increment sold count or credit the seller ledger.
- [ ] Verify confirmed payment updates purchase status, sold count, pack status, and seller ledger in one database transaction.
- [ ] Verify a ledger inconsistency is surfaced for manual reconciliation rather than repaired by a series of non-atomic writes.
- [ ] Verify refund/dispute and payout flows in a separate approved test plan. Do not mark a payout as sent unless an administrator has actually sent it; this application status does not initiate a transfer.

## 5. SEO, trust, and policy
- [ ] Check `/robots.txt` and `/sitemap.xml` on preview; private dashboard/admin/API/account routes must not be in the sitemap.
- [ ] Verify canonical and Open Graph URLs point to the intended public domain before launch.
- [ ] Verify page titles/descriptions for home, pricing, leads, samples, terms, privacy, and refund.
- [ ] Confirm Terms, Privacy, and Refund pages have the current revision date and no stale payment-provider claims.
- [ ] Verify checkout displays and records the exact terms/refund policy version before creating a purchase.
- [ ] Review lead-pack source rights, data minimization, lawful marketing use, refund handling, and contact details.

## Release blockers
- The atomic checkout migration must be reviewed and applied before deploying application code that calls its RPCs. It has **not** been applied to production by this task.
- Provider sandbox configuration and Supabase Auth redirect allow-list must be verified for each deployment hostname.
- A live production smoke test is still required after preview tests pass. No production deployment or real payment was performed here.
