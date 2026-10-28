import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '../lib/emailTemplates.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const module = { exports: {} }
vm.runInNewContext(outputText, { module, exports: module.exports, URL }, { filename: 'emailTemplates.js' })
const { buildWelcomeEmail } = module.exports

test('welcome email includes branded HTML and a plain-text alternative', () => {
  const email = buildWelcomeEmail('https://dropverse10v.vercel.app')
  assert.equal(email.subject, 'Welcome to DropVerse')
  assert.match(email.text, /Welcome to DropVerse!/)
  assert.match(email.text, /https:\/\/dropverse10v\.vercel\.app/)
  assert.match(email.html, /#073b3a/i)
  assert.match(email.html, /#d7b65b/i)
  assert.match(email.html, /role="presentation"/i)
  assert.match(email.html, /href="https:\/\/dropverse10v\.vercel\.app"/i)
})

test('welcome email escapes URL content before inserting it into HTML', () => {
  const email = buildWelcomeEmail('https://dropverse10v.vercel.app/?q=a&x=b')
  assert.match(email.html, /href="https:\/\/dropverse10v\.vercel\.app"/i)
  assert.doesNotMatch(email.html, /q=a&x=b/)
})

test('invalid URL schemes fall back to the configured app URL', () => {
  const email = buildWelcomeEmail('javascript:alert(1)')
  assert.match(email.html, /href="https:\/\/dropverse10v\.vercel\.app"/i)
  assert.match(email.text, /https:\/\/dropverse10v\.vercel\.app/)
})
