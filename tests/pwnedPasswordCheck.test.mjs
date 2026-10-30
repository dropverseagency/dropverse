import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(root, file), 'utf8')
const checker = read('lib/checkPasswordBreach.ts')
const login = read('app/login/page.tsx')
const reset = read('app/reset-password/page.tsx')

assert.match(checker, /crypto\.subtle\.digest\(\s*'SHA-1'/)
assert.match(checker, /const prefix = hash\.slice\(0, 5\)/)
assert.match(checker, /const suffix = hash\.slice\(5\)/)
assert.match(checker, /api\.pwnedpasswords\.com\/range\/\$\{prefix\}/)
assert.match(checker, /'Add-Padding': 'true'/)
assert.match(checker, /returnedSuffix === suffix && Number\.isFinite\(count\) && count > 0/)
assert.match(checker, /return 'unavailable'/)
assert.doesNotMatch(checker, /fetch\([^\n]*password\)/i)
assert.doesNotMatch(checker, /JSON\.stringify\(\s*\{\s*password/i)

assert.match(login, /checkPasswordBreach\(password\)/)
assert.ok(login.indexOf('checkPasswordBreach(password)') < login.indexOf('supabase.auth.signUp('))
assert.match(login, /breachStatus === 'compromised'/)
assert.match(login, /breachStatus === 'unavailable'/)
assert.match(login, /the full password is not sent to the breach-check service/)

assert.match(reset, /checkPasswordBreach\(password\)/)
assert.ok(reset.indexOf('checkPasswordBreach(password)') < reset.indexOf('auth.updateUser({ password })'))
assert.match(reset, /breachStatus === 'compromised'/)
assert.match(reset, /breachStatus === 'unavailable'/)

console.log('pwnedPasswordCheck.test.mjs: ok')
