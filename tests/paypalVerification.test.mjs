import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(__dirname, '../lib/paypalVerification.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const modulePath = path.join(__dirname, '../.tmp-paypalVerification.cjs')
writeFileSync(modulePath, outputText)
const require = createRequire(import.meta.url)
const { verifyPayPalOrder, isValidPayPalOrderId } = require(modulePath)

const orderId = '5O190127TN364715T'
const completedOrder = {
  id: orderId,
  status: 'COMPLETED',
  purchase_units: [{
    custom_id: 'dv:invoice:invoice-123:25.00',
    payments: {
      captures: [{
        id: '3C679366HH908993F',
        status: 'COMPLETED',
        amount: { value: '25.00', currency_code: 'USD' },
      }],
    },
  }],
}
function deps({ token = 'server-access-token', response = completedOrder, responseOk = true, fetchThrows = false } = {}) {
  let fetchCalls = 0
  return {
    getAccessToken: async () => token,
    fetchOrder: async (id, receivedToken) => {
      fetchCalls += 1
      assert.equal(id, orderId)
      assert.equal(receivedToken, 'server-access-token')
      if (fetchThrows) throw new Error('network error')
      return {
        ok: responseOk,
        status: responseOk ? 200 : 500,
        json: async () => response,
        text: async () => 'PayPal unavailable',
      }
    },
    getFetchCalls: () => fetchCalls,
  }
}

assert.equal(isValidPayPalOrderId(orderId), true)
assert.equal(isValidPayPalOrderId('12345678'), false)
assert.equal(isValidPayPalOrderId('not-an-order-id!'), false)

{
  const d = deps({ token: null })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', 'dv:invoice:invoice-123:25.00', d)
  assert.deepEqual(result, { ok: false, error: 'PAYPAL_VERIFY_FAILED' })
  assert.equal(d.getFetchCalls(), 0, 'must not query PayPal without a server access token')
}

{
  const d = deps()
  const result = await verifyPayPalOrder('12345678', 25, 'USD', 'dv:invoice:invoice-123:25.00', d)
  assert.equal(result.ok, false, 'malformed order IDs must fail')
  assert.equal(d.getFetchCalls(), 0, 'malformed order IDs must be rejected before network calls')
}

{
  const d = deps({ responseOk: false })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.equal(result.ok, false, 'PayPal API errors must not be treated as payment')
}

{
  const d = deps({ response: { ...completedOrder, status: 'APPROVED', purchase_units: [] } })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.deepEqual(result, { ok: false, error: 'PAYPAL_VERIFY_FAILED' })
}

{
  const d = deps({ response: { ...completedOrder, purchase_units: [{ payments: { captures: [] } }] } })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.deepEqual(result, { ok: false, error: 'PAYPAL_VERIFY_FAILED' })
}

{
  const d = deps({ response: { ...completedOrder, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE123456789', status: 'PENDING', amount: { value: '25.00', currency_code: 'USD' } }] } }] } })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.deepEqual(result, { ok: false, error: 'PAYPAL_VERIFY_FAILED' })
}

{
  const d = deps()
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.deepEqual(result, {
    ok: true,
    data: {
      id: orderId,
      status: 'COMPLETED',
      amount: 25,
      currency: 'USD',
      captureId: '3C679366HH908993F',
    },
  })
}

{
  const d = deps({ response: { ...completedOrder, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE123456789', status: 'COMPLETED', amount: { value: '24.00', currency_code: 'USD' } }] } }] } })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.equal(result.ok, false)
  assert.equal(result.error, 'SP_AMOUNT_MISMATCH')
}

{
  const d = deps({ response: { ...completedOrder, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE123456789', status: 'COMPLETED', amount: { value: '25.00', currency_code: 'EUR' } }] } }] } })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.equal(result.ok, false)
  assert.equal(result.error, 'SP_AMOUNT_MISMATCH')
}

{
  const d = deps({ response: { ...completedOrder, id: 'DIFFERENTORDER12345' } })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', d)
  assert.deepEqual(result, { ok: false, error: 'PAYPAL_VERIFY_FAILED' })
}

{
  const d = deps({ response: { ...completedOrder, purchase_units: [{ ...completedOrder.purchase_units[0], custom_id: 'dv:invoice:another-invoice:25.00' }] } })
  const result = await verifyPayPalOrder(orderId, 25, 'USD', 'dv:invoice:invoice-123:25.00', d)
  assert.deepEqual(result, { ok: false, error: 'PAYPAL_VERIFY_FAILED' }, 'a paid order must be tied to the invoice being paid')
}

unlinkSync(modulePath)
console.log('paypalVerification.test.mjs: ok')
