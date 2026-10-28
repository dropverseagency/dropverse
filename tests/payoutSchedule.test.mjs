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
const srcPath = path.join(__dirname, '../lib/payoutConfig.ts')
const source = fs.readFileSync(srcPath, 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, strict: true },
  fileName: 'payoutConfig.ts',
})
const mod = { exports: {} }
vm.runInNewContext(outputText, { module: mod, exports: mod.exports, require, console }, { filename: 'payoutConfig.js' })
const { nextScheduledProcessingDate } = mod.exports
const date = (day) => new Date(Date.UTC(2026, 9, day, 12))
const ymd = (value) => nextScheduledProcessingDate(value).toISOString().slice(0, 10)

test('requests by the 3rd target the 5th cycle', () => {
  assert.equal(ymd(date(1)), '2026-10-05')
  assert.equal(ymd(date(3)), '2026-10-05')
})

test('requests after the 3rd through the 18th target the 20th cycle', () => {
  assert.equal(ymd(date(4)), '2026-10-20')
  assert.equal(ymd(date(18)), '2026-10-20')
})

test('requests after the 18th roll to the next month 5th cycle', () => {
  assert.equal(ymd(date(19)), '2026-11-05')
  assert.equal(ymd(date(20)), '2026-11-05')
  assert.equal(ymd(date(31)), '2026-11-05')
})
