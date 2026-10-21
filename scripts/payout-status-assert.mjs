/**
 * Assert payout status model matches production constraint.
 * Keep in sync with lib/payoutStatus.ts
 */
const PAYOUT_REQUEST_STATUSES = ['pending', 'approved', 'paid', 'cancelled']
const ALLOWED_TRANSITIONS = {
  pending: ['approved', 'cancelled', 'pending'],
  approved: ['paid', 'cancelled', 'approved', 'pending'],
  paid: ['paid'],
  cancelled: ['cancelled'],
}
function isAllowed(s) {
  return PAYOUT_REQUEST_STATUSES.includes(s)
}
function canTransition(from, to) {
  if (!isAllowed(from) || !isAllowed(to)) return false
  return ALLOWED_TRANSITIONS[from].includes(to)
}
function assert(c, m) {
  if (!c) throw new Error(m)
}
let n = 0
const ok = (m) => {
  n++
  console.log('ok', m)
}

for (const s of PAYOUT_REQUEST_STATUSES) {
  assert(isAllowed(s), s)
  ok(`allowed ${s}`)
}
assert(!isAllowed('rejected'), 'rejected not allowed')
ok('rejected not allowed')
assert(!isAllowed('failed'), 'failed not allowed')
ok('failed not allowed')

for (const [f, t] of [
  ['pending', 'approved'],
  ['pending', 'cancelled'],
  ['approved', 'paid'],
  ['approved', 'cancelled'],
  ['approved', 'pending'],
  ['paid', 'paid'],
  ['cancelled', 'cancelled'],
]) {
  assert(canTransition(f, t), `${f}->${t}`)
  ok(`${f}->${t}`)
}
for (const [f, t] of [
  ['paid', 'pending'],
  ['paid', 'approved'],
  ['paid', 'cancelled'],
  ['cancelled', 'pending'],
  ['cancelled', 'approved'],
  ['cancelled', 'paid'],
  ['pending', 'paid'],
  ['rejected', 'cancelled'],
  ['pending', 'rejected'],
]) {
  assert(!canTransition(f, t), `block ${f}->${t}`)
  ok(`blocked ${f}->${t}`)
}
assert(PAYOUT_REQUEST_STATUSES.length === 4, 'count')
ok('count')
console.log(`PASS ${n}`)
