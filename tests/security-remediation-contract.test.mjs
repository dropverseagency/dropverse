import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(root, file), 'utf8')
const migration = read('supabase/migrations/20261029000000_security_remediation.sql')
const limiter = read('lib/rateLimit.ts')
const turnstile = read('lib/turnstile.ts')
const projectCreate = read('lib/createProject.ts')
const invoicePay = read('app/api/invoices/pay/route.ts')
const callback = read('app/api/spaceremit/callback/route.ts')
const verify = read('app/api/spaceremit/verify/route.ts')
const terms = read('app/api/legal/acceptance/route.ts')

assert.match(migration, /drop policy if exists "users create own payouts"/i)
assert.match(migration, /revoke insert,update,delete on table public\\.payout_requests from public,anon,authenticated/i)
assert.match(migration, /revoke insert,update,delete on table public\\.audit_logs from public,anon,authenticated/i)
assert.match(migration, /create trigger guard_project_financial_mutations/i)
assert.match(migration, /create trigger guard_invoice_mutations/i)
assert.match(migration, /consume_rate_limit_bucket/i)
assert.match(limiter, /rpc\/consume_rate_limit_bucket/)
assert.doesNotMatch(limiter, /backend: 'fail-open'/)
assert.match(turnstile, /verification service unavailable; rejecting request/)
assert.match(projectCreate, /spaceremit_payment_id: null/)
assert.match(projectCreate, /adminClient\(\)\.from\('projects'\)\.insert/)
assert.match(invoicePay, /INVOICE_ALREADY_PROCESSED/)
assert.match(invoicePay, /consentValue\?\.item_id !== invoiceId/)
assert.match(callback, /Math\.abs\(paid - expected\) >= 0\.01/)
assert.match(verify, /adminClient\(\)\.from\('audit_logs'\)\.insert/)
assert.match(terms, /item_id: String\(body\.itemId \|\| ''\)\.trim\(\)/)
console.log('security-remediation-contract.test.mjs: ok')
