import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(path.join(root, 'supabase/migrations/20261030025452_security_performance_hardening_oct30.sql'), 'utf8')
const config = readFileSync(path.join(root, 'next.config.ts'), 'utf8')

assert.match(migration, /ALTER POLICY/)
assert.match(migration, /regexp_replace\(new_qual, 'auth\\\\\.uid/)
assert.match(migration, /DROP INDEX IF EXISTS public\.idx_referral_codes_code_unique/)
assert.match(migration, /DROP INDEX IF EXISTS public\.idx_referrals_referred_user_unique/)
assert.match(migration, /REVOKE ALL ON TABLE/)
assert.match(migration, /CREATE INDEX IF NOT EXISTS/)
assert.equal((migration.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 40)
assert.match(config, /CSP_ENFORCE === 'true'/)
assert.match(config, /object-src 'none'/)
assert.match(config, /https:\/\/www\.paypal\.com/)
assert.match(config, /https:\/\/api-m\.paypal\.com/)
assert.doesNotMatch(config, /'unsafe-eval'/)
console.log('security-hardening-followup.test.mjs: ok')
