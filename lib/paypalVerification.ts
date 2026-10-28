export type PayPalCaptureResult =
  | {
      ok: true
      data: {
        id: string
        status: 'COMPLETED'
        amount: number
        currency: string
        captureId: string
      }
    }
  | { ok: false; error: 'PAYPAL_VERIFY_FAILED' | 'SP_AMOUNT_MISMATCH'; detail?: unknown }

type PayPalResponseLike = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

type VerifyPayPalOrderDependencies = {
  getAccessToken: () => Promise<string | null>
  fetchOrder: (orderId: string, accessToken: string) => Promise<PayPalResponseLike>
}

type PayPalCapture = {
  id?: unknown
  status?: unknown
  amount?: { value?: unknown; currency_code?: unknown } | null
}

type PayPalOrder = {
  id?: unknown
  status?: unknown
  purchase_units?: Array<{
    payments?: { captures?: PayPalCapture[] | null } | null
  }> | null
}

export function isValidPayPalOrderId(orderId: string): boolean {
  // PayPal order IDs are opaque alphanumeric IDs. Never accept arbitrary text
  // or use its length as evidence that a payment happened.
  return /^[A-Za-z0-9]{10,64}$/.test(orderId)
}

export async function verifyPayPalOrder(
  rawOrderId: string,
  expectedAmount: number,
  expectedCurrency: string,
  dependencies: VerifyPayPalOrderDependencies,
): Promise<PayPalCaptureResult> {
  const orderId = String(rawOrderId || '').trim()
  const currencyExpected = String(expectedCurrency || '').trim().toUpperCase()

  if (
    !isValidPayPalOrderId(orderId) ||
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0 ||
    !/^[A-Z]{3}$/.test(currencyExpected)
  ) {
    return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
  }

  let accessToken: string | null
  try {
    accessToken = await dependencies.getAccessToken()
  } catch {
    return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
  }
  if (!accessToken) {
    return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
  }

  let response: PayPalResponseLike
  try {
    response = await dependencies.fetchOrder(orderId, accessToken)
  } catch {
    return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
  }
  if (!response.ok) {
    return {
      ok: false,
      error: 'PAYPAL_VERIFY_FAILED',
      detail: await response.text().catch(() => ''),
    }
  }

  let order: PayPalOrder
  try {
    order = (await response.json()) as PayPalOrder
  } catch {
    return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
  }

  // A caller-supplied order ID is not proof of payment. The response must
  // identify the same order, and the order itself must be fully completed.
  if (order?.id !== orderId || String(order?.status || '').toUpperCase() !== 'COMPLETED') {
    return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
  }

  const captures = order.purchase_units?.flatMap((unit) => unit.payments?.captures || []) || []
  const completedCaptures = captures.filter((capture) => String(capture?.status || '').toUpperCase() === 'COMPLETED')
  if (completedCaptures.length === 0) {
    return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
  }

  let paidAmount = 0
  let captureCurrency: string | null = null
  for (const capture of completedCaptures) {
    const value = Number(capture?.amount?.value)
    const currency = String(capture?.amount?.currency_code || '').toUpperCase()
    if (!capture?.id || !Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return { ok: false, error: 'PAYPAL_VERIFY_FAILED' }
    }
    if (captureCurrency && currency !== captureCurrency) {
      return { ok: false, error: 'SP_AMOUNT_MISMATCH', detail: { currency, expectedCurrency: currencyExpected } }
    }
    captureCurrency = currency
    paidAmount += value
  }

  if (
    captureCurrency !== currencyExpected ||
    Math.abs(paidAmount - expectedAmount) >= 0.01
  ) {
    return {
      ok: false,
      error: 'SP_AMOUNT_MISMATCH',
      detail: { paid: paidAmount, currency: captureCurrency, expectedAmount, expectedCurrency: currencyExpected },
    }
  }

  return {
    ok: true,
    data: {
      id: orderId,
      status: 'COMPLETED',
      amount: paidAmount,
      currency: captureCurrency,
      captureId: String(completedCaptures[0].id),
    },
  }
}
