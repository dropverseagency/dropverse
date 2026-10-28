import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('lead marketplace uses the published 20% commission', () => {
  const types = read('../lib/leads/types.ts')
  assert.match(types, /LEAD_COMMISSION_DEFAULT\s*=\s*0\.20/)
  assert.match(types, /return LEAD_COMMISSION_DEFAULT/)
})

test('checkout requires terms consent and uses the atomic seat reservation RPC', () => {
  const checkout = read('../app/api/leads/[id]/checkout/route.ts')
  assert.match(checkout, /acceptedTerms !== true/)
  assert.match(checkout, /termsVersion !== '2026-10-28'/)
  assert.match(checkout, /create_lead_pack_purchase_atomic/)
  assert.doesNotMatch(checkout, /\.from\('lead_pack_purchases'\)\s*\.insert/)
})

test('payment is verified server-side before atomic confirmation', () => {
  const confirm = read('../app/api/leads/purchases/confirm/route.ts')
  assert.ok(confirm.indexOf("fetch('https://spaceremit.com/api/v2/payment_info/'") >= 0)
  assert.ok(confirm.indexOf("fetch('https://spaceremit.com/api/v2/payment_info/'") < confirm.indexOf("rpc('confirm_lead_pack_purchase_atomic'"))
  assert.match(confirm, /SP_AMOUNT_MISMATCH/)
  assert.match(confirm, /PAYMENT_REQUIRES_REVIEW/)
})

test('lead downloads require an authenticated buyer and a paid purchase', () => {
  const download = read('../app/api/leads/purchases/[id]/download/route.ts')
  assert.match(download, /requireUser\(\)/)
  assert.match(download, /purchase\.buyer_id !== userId/)
  assert.match(download, /purchase\.status !== 'paid'/)
  assert.match(download, /createSignedUrl/)
})

test('password recovery sends a reset link and requires a session before changing the password', () => {
  const forgot = read('../app/forgot-password/page.tsx')
  const reset = read('../app/reset-password/page.tsx')
  assert.match(forgot, /resetPasswordForEmail/)
  assert.match(forgot, /reset-password/)
  assert.match(reset, /exchangeCodeForSession/)
  assert.match(reset, /getSession/)
  assert.match(reset, /updateUser\(\{ password \}\)/)
  assert.match(reset, /password !== confirmPassword/)
})

test('SEO files keep private routes out of indexing and publish a public sitemap', () => {
  const robots = read('../app/robots.ts')
  const sitemap = read('../app/sitemap.ts')
  assert.match(robots, /\/dashboard/)
  assert.match(robots, /\/admin/)
  assert.match(robots, /\/api\//)
  assert.match(sitemap, /\/pricing/)
  assert.match(sitemap, /\/privacy/)
  assert.doesNotMatch(sitemap, /\/dashboard|\/admin|\/login|\/reset-password/)
})

test('lead pack reservation migration is transactional and server-role only', () => {
  const migration = read('../supabase/migrations/20261028080000_atomic_lead_pack_checkout.sql')
  assert.match(migration, /for update/i)
  assert.match(migration, /expires_at/)
  assert.match(migration, /lead_pack_purchases_buyer_active_unique/)
  assert.match(migration, /grant execute on function public\.confirm_lead_pack_purchase_atomic\(uuid, text\) to service_role/i)
  assert.match(migration, /platform commission 20%/)
})
