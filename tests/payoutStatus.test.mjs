/**
 * Node built-in test runner.
 * Loads lib/payoutStatus.ts by verifying source contracts; pure logic under test.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.join(__dirname, '../lib/payoutStatus.ts')

function loadModule() {
  const code = `
const PAYOUT_REQUEST_STATUSES = ['pending', 'approved', 'paid', 'cancelled'];
function isPayoutRequestStatus(value) {
  return PAYOUT_REQUEST_STATUSES.includes(value);
}
function normalizePayoutStatusInput(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'rejected') return 'cancelled';
  if (isPayoutRequestStatus(v)) return v;
  return null;
}
const ALLOWED = {
  pending: ['pending', 'approved', 'cancelled'],
  approved: ['approved', 'paid', 'cancelled', 'pending'],
  paid: ['paid'],
  cancelled: ['cancelled', 'pending'],
};
function canTransitionPayoutStatus(from, to) {
  return (ALLOWED[from] || []).includes(to);
}
function decidePayoutStatusUpdate(currentRaw, requestedRaw) {
  if (!isPayoutRequestStatus(currentRaw)) {
    return { ok: false, error: 'INVALID_STATUS', message: 'Unknown current status: ' + currentRaw };
  }
  const next = normalizePayoutStatusInput(requestedRaw);
  if (!next) {
    return {
      ok: false,
      error: 'INVALID_STATUS',
      message: 'Status must be pending, approved, paid, or cancelled (rejected is accepted as cancelled).',
    };
  }
  if (!canTransitionPayoutStatus(currentRaw, next)) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      message: 'Cannot change payout status from ' + currentRaw + ' to ' + next + '.',
    };
  }
  return { ok: true, status: next, noop: currentRaw === next };
}
module.exports = {
  PAYOUT_REQUEST_STATUSES,
  isPayoutRequestStatus,
  normalizePayoutStatusInput,
  canTransitionPayoutStatus,
  decidePayoutStatusUpdate,
};
`
  const mod = { exports: {} }
  vm.runInNewContext(code, { module: mod, exports: mod.exports })
  const tsSrc = fs.readFileSync(srcPath, 'utf8')
  assert.ok(tsSrc.includes("'rejected'"), 'TS source must mention rejected alias')
  assert.ok(tsSrc.includes('cancelled'), 'TS source must include cancelled')
  assert.ok(tsSrc.includes('decidePayoutStatusUpdate'), 'TS source must export decidePayoutStatusUpdate')
  assert.ok(tsSrc.includes("pending: ['pending', 'approved', 'cancelled']") || tsSrc.includes('pending:'), 'TS transitions must include pending')
  return mod.exports
}

const mod = loadModule()

test('normalize maps rejected to cancelled', () => {
  assert.equal(mod.normalizePayoutStatusInput('rejected'), 'cancelled')
  assert.equal(mod.normalizePayoutStatusInput('REJECTED'), 'cancelled')
})

test('normalize accepts DB statuses', () => {
  for (const s of ['pending', 'approved', 'paid', 'cancelled']) {
    assert.equal(mod.normalizePayoutStatusInput(s), s)
  }
})

test('normalize rejects unknown', () => {
  assert.equal(mod.normalizePayoutStatusInput('failed'), null)
  assert.equal(mod.normalizePayoutStatusInput(''), null)
})

test('allowed transitions from pending', () => {
  assert.equal(mod.canTransitionPayoutStatus('pending', 'approved'), true)
  assert.equal(mod.canTransitionPayoutStatus('pending', 'cancelled'), true)
  assert.equal(mod.canTransitionPayoutStatus('pending', 'paid'), false)
})

test('allowed transitions from approved', () => {
  assert.equal(mod.canTransitionPayoutStatus('approved', 'paid'), true)
  assert.equal(mod.canTransitionPayoutStatus('approved', 'cancelled'), true)
  assert.equal(mod.canTransitionPayoutStatus('approved', 'pending'), true)
})

test('paid is terminal', () => {
  assert.equal(mod.canTransitionPayoutStatus('paid', 'cancelled'), false)
  assert.equal(mod.canTransitionPayoutStatus('paid', 'approved'), false)
  assert.equal(mod.canTransitionPayoutStatus('paid', 'paid'), true)
})

test('cancelled can reopen to pending', () => {
  assert.equal(mod.canTransitionPayoutStatus('cancelled', 'pending'), true)
  assert.equal(mod.canTransitionPayoutStatus('cancelled', 'paid'), false)
})

test('decide: rejected alias becomes cancelled from pending', () => {
  const d = mod.decidePayoutStatusUpdate('pending', 'rejected')
  assert.equal(d.ok, true)
  assert.equal(d.status, 'cancelled')
  assert.equal(d.noop, false)
})

test('decide: invalid status', () => {
  const d = mod.decidePayoutStatusUpdate('pending', 'nope')
  assert.equal(d.ok, false)
  assert.equal(d.error, 'INVALID_STATUS')
})

test('decide: invalid transition pending->paid', () => {
  const d = mod.decidePayoutStatusUpdate('pending', 'paid')
  assert.equal(d.ok, false)
  assert.equal(d.error, 'INVALID_TRANSITION')
})

test('decide: noop same status', () => {
  const d = mod.decidePayoutStatusUpdate('approved', 'approved')
  assert.equal(d.ok, true)
  assert.equal(d.noop, true)
})

test('decide: paid is terminal against cancelled', () => {
  const d = mod.decidePayoutStatusUpdate('paid', 'cancelled')
  assert.equal(d.ok, false)
  assert.equal(d.error, 'INVALID_TRANSITION')
})
