/**
 * Node built-in test runner.
 * Executes the real lib/payoutStatus.ts implementation via TypeScript transpile
 * so tests fail if the source-of-truth logic changes incorrectly.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.join(__dirname, '../lib/payoutStatus.ts')

function loadRealModule() {
  const source = fs.readFileSync(srcPath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      strict: true,
    },
    fileName: 'payoutStatus.ts',
  })
  const mod = { exports: {} }
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require,
    console,
  }
  vm.runInNewContext(outputText, sandbox, { filename: 'payoutStatus.js' })
  return mod.exports
}

const mod = loadRealModule()

test('normalize maps rejected to cancelled', () => {
  assert.equal(mod.normalizePayoutStatusInput('rejected'), 'cancelled')
  assert.equal(mod.normalizePayoutStatusInput('REJECTED'), 'cancelled')
})

test('normalize accepts DB statuses', () => {
  for (const s of ['pending', 'approved', 'paid', 'cancelled']) {
    assert.equal(mod.normalizePayoutStatusInput(s), s)
  }
})

test('normalize rejects unknown statuses', () => {
  assert.equal(mod.normalizePayoutStatusInput('failed'), null)
  assert.equal(mod.normalizePayoutStatusInput('reversed'), null)
  assert.equal(mod.normalizePayoutStatusInput(''), null)
})

test('allowed transitions from pending', () => {
  assert.equal(mod.canTransitionPayoutStatus('pending', 'approved'), true)
  assert.equal(mod.canTransitionPayoutStatus('pending', 'cancelled'), true)
  assert.equal(mod.canTransitionPayoutStatus('pending', 'paid'), false)
  assert.equal(mod.canTransitionPayoutStatus('pending', 'pending'), true)
})

test('allowed transitions from approved', () => {
  assert.equal(mod.canTransitionPayoutStatus('approved', 'paid'), true)
  assert.equal(mod.canTransitionPayoutStatus('approved', 'cancelled'), true)
  assert.equal(mod.canTransitionPayoutStatus('approved', 'pending'), false)
  assert.equal(mod.canTransitionPayoutStatus('approved', 'approved'), true)
})

test('paid is terminal', () => {
  assert.equal(mod.canTransitionPayoutStatus('paid', 'cancelled'), false)
  assert.equal(mod.canTransitionPayoutStatus('paid', 'approved'), false)
  assert.equal(mod.canTransitionPayoutStatus('paid', 'pending'), false)
  assert.equal(mod.canTransitionPayoutStatus('paid', 'paid'), true)
})

test('cancelled is terminal (no reopen)', () => {
  assert.equal(mod.canTransitionPayoutStatus('cancelled', 'pending'), false)
  assert.equal(mod.canTransitionPayoutStatus('cancelled', 'paid'), false)
  assert.equal(mod.canTransitionPayoutStatus('cancelled', 'approved'), false)
  assert.equal(mod.canTransitionPayoutStatus('cancelled', 'cancelled'), true)
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

test('decide: invalid transition approved->pending (no reopen)', () => {
  const d = mod.decidePayoutStatusUpdate('approved', 'pending')
  assert.equal(d.ok, false)
  assert.equal(d.error, 'INVALID_TRANSITION')
})

test('decide: invalid transition cancelled->pending (no reopen)', () => {
  const d = mod.decidePayoutStatusUpdate('cancelled', 'pending')
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
