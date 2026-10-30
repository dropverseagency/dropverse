import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = readFileSync(path.join(root, 'next.config.ts'), 'utf8')

assert.match(config, /CSP_ENFORCE === 'true'/)
assert.match(config, /key: enforce \? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'/)
assert.match(config, /object-src 'none'/)
assert.match(config, /media-src 'self' data: blob:/)
assert.match(config, /https:\/\/www\.paypal\.com/)
assert.match(config, /https:\/\/api-m\.paypal\.com/)
assert.doesNotMatch(config, /'unsafe-eval'/)
assert.match(config, /frame-ancestors 'none'/)
console.log('csp-hardening.test.mjs: ok')
