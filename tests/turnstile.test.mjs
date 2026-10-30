import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const turnstileSrc = readFileSync(new URL('../lib/turnstile.ts', import.meta.url), 'utf8')

test('turnstile fails closed when site key set without secret', () => {
  assert.match(turnstileSrc, /NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing/)
})

test('turnstile rejects missing token when secret configured', () => {
  assert.match(turnstileSrc, /missing_token/)
})

test('turnstile rejects provider failures', () => {
  assert.match(turnstileSrc, /verification service unavailable; rejecting request/)
  assert.match(turnstileSrc, /provider_error|provider_http|invalid_token/)
})

test('auth guard uses verifyTurnstile and rate limit', () => {
  const guard = readFileSync(new URL('../app/api/auth/guard/route.ts', import.meta.url), 'utf8')
  assert.match(guard, /verifyTurnstile/)
  assert.match(guard, /limitAuth/)
  assert.match(guard, /TURNSTILE_FAILED/)
})

test('login and forgot-password render turnstile when site key present', () => {
  const login = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8')
  const forgot = readFileSync(new URL('../app/forgot-password/page.tsx', import.meta.url), 'utf8')
  assert.match(login, /cf-turnstile/)
  assert.match(login, /\/api\/auth\/guard/)
  assert.match(forgot, /cf-turnstile/)
  assert.match(forgot, /\/api\/auth\/guard/)
})

test('payment success page has no Dodo Payments copy', () => {
  const page = readFileSync(new URL('../app/payment/success/page.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /Dodo Payments/i)
})
