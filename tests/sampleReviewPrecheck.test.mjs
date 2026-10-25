import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.join(__dirname, '../lib/agents/sampleReviewPrecheck.ts')
const source = readFileSync(srcPath, 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const modulePath = path.join(__dirname, '../.tmp-sampleReviewPrecheck.cjs')
writeFileSync(modulePath, outputText)
const require = createRequire(import.meta.url)
const {
  detectContactLeak,
  matchMagicBytes,
  validatePriceTurnaround,
  buildPrecheckVerdict,
} = require(modulePath)

assert.deepEqual(detectContactLeak('hello@example.com'), ['email'])
assert.ok(detectContactLeak('wa.me/123').includes('whatsapp'))
assert.equal(detectContactLeak('clean portfolio description').length, 0)

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
assert.equal(matchMagicBytes(jpeg, 'image'), true)
assert.equal(matchMagicBytes(Uint8Array.from([1, 2, 3, 4]), 'image'), false)

const priceItems = validatePriceTurnaround({ priceUsd: null, turnaroundDays: 3 })
assert.ok(priceItems.every((i) => i.ok))

const bad = buildPrecheckVerdict({
  title: 'Call me +201000000000',
  description: 'x',
  rightsAttested: false,
  fileCount: 0,
  hasCost: false,
  hasProfile: false,
  turnaroundDays: 3,
  priceUsd: null,
})
assert.equal(bad.verdict, 'needs_attention')

const good = buildPrecheckVerdict({
  title: 'Logo pack',
  description: 'Clean work',
  rightsAttested: true,
  fileCount: 2,
  hasCost: true,
  hasProfile: true,
  turnaroundDays: 5,
  priceUsd: 120,
  magicFailures: 0,
})
assert.equal(good.verdict, 'ready_for_human_review')

console.log('sampleReviewPrecheck.test.mjs: ok')
