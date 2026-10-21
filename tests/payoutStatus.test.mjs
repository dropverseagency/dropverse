/**
 * Node built-in test runner (node --test). Pure logic; no DB.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.join(__dirname, '../lib/payoutStatus.ts')

function loadViaTs() {
  const ts = require('typescript')
  const src = fs.readFileSync(srcPath, 'utf8')
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const out = path.join(__dirname, '.payoutStatus.generated.cjs')
  fs.writeFileSync(out, outputText)
  delete require.cache[require.resolve(out)]
  return require(out)
}

const mod = loadViaTs()

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
