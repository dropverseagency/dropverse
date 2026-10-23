export function whopConfig() {
  const apiKey = process.env.WHOP_COMPANY_API_KEY || process.env.WHOP_API_KEY
  const companyId = process.env.WHOP_COMPANY_ID
  if (!apiKey || !companyId) throw new Error('WHOP_NOT_CONFIGURED')
  return { apiKey, companyId }
}

function whopBaseUrl() {
  return process.env.WHOP_SANDBOX === 'true'
    ? 'https://sandbox-api.whop.com/api/v1'
    : 'https://api.whop.com/api/v1'
}

async function whopRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey } = whopConfig()
  const response = await fetch(`${whopBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null) as T | { error?: { message?: string }; message?: string } | null
  if (!response.ok || !result) {
    const message = result && typeof result === 'object' && 'message' in result
      ? String((result as { message?: unknown }).message || '')
      : result && typeof result === 'object' && 'error' in result
        ? String((result as { error?: { message?: unknown } }).error?.message || '')
        : ''
    console.error('[whop] API request failed', response.status, path, message)
    throw new Error('WHOP_API_REQUEST_FAILED')
  }
  return result as T
}

export async function createWhopPlan(input: {
  productId: string
  title: string
  amount: number
  planType?: 'one_time' | 'renewal'
  billingPeriod?: number
  renewalPrice?: number
}) {
  const { companyId } = whopConfig()
  if (!input.productId) throw new Error('WHOP_PRODUCT_NOT_CONFIGURED')
  const amount = Math.round(input.amount * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT')
  const planType = input.planType ?? 'one_time'
  const body = {
    company_id: companyId,
    product_id: input.productId,
    title: input.title.slice(0, 30),
    description: 'DropVerse secure checkout',
    plan_type: planType,
    currency: 'usd',
    visibility: 'hidden',
    release_method: 'buy_now',
    initial_price: planType === 'one_time' ? amount : 0,
    renewal_price: planType === 'renewal' ? Math.round((input.renewalPrice ?? amount) * 100) / 100 : 0,
    ...(planType === 'renewal' ? { billing_period: input.billingPeriod ?? 30 } : {}),
    unlimited_stock: true,
  }
  const result = await whopRequest<{ id?: string }>('/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!result.id) throw new Error('WHOP_PLAN_CREATE_FAILED')
  return { planId: result.id }
}

export async function createWhopCheckout(planId: string, orderId: string) {
  const result = await whopRequest<{ id?: string }>('/checkout_configurations', {
    method: 'POST',
    headers: { 'Idempotency-Key': `dropverse-checkout-${orderId}` },
    body: JSON.stringify({ plan_id: planId, mode: 'payment', metadata: { order_id: orderId } }),
  })
  if (!result.id) throw new Error('WHOP_CHECKOUT_CREATE_FAILED')
  return { sessionId: result.id }
}

export async function retrieveWhopPlan(planId: string) {
  return whopRequest<Record<string, unknown>>(`/plans/${encodeURIComponent(planId)}`)
}

export async function retrieveWhopPayment(paymentId: string) {
  return whopRequest<Record<string, unknown>>(`/payments/${encodeURIComponent(paymentId)}`)
}
