import Whop from '@whop/sdk'

export function whopConfig() {
  const apiKey = process.env.WHOP_COMPANY_API_KEY || process.env.WHOP_API_KEY
  const companyId = process.env.WHOP_COMPANY_ID
  if (!apiKey || !companyId) throw new Error('WHOP_NOT_CONFIGURED')
  return { apiKey, companyId }
}

export function whopClient() {
  const { apiKey } = whopConfig()
  const sandbox = process.env.WHOP_SANDBOX === 'true'
  return new Whop({
    apiKey,
    baseURL: sandbox ? 'https://sandbox-api.whop.com/api/v1' : 'https://api.whop.com/api/v1',
    ...(process.env.WHOP_WEBHOOK_SECRET
      ? { webhookKey: Buffer.from(process.env.WHOP_WEBHOOK_SECRET).toString('base64') }
      : {}),
  })
}

export async function createWhopPlan(input: {
  productId: string
  title: string
  amount: number
  planType?: 'one_time' | 'renewal'
  billingPeriod?: number
  renewalPrice?: number
}) {
  const { apiKey, companyId } = whopConfig()
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
  const baseUrl = process.env.WHOP_SANDBOX === 'true' ? 'https://sandbox-api.whop.com/api/v1' : 'https://api.whop.com/api/v1'
  const response = await fetch(`${baseUrl}/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null) as { id?: string; message?: string; error?: string } | null
  if (!response.ok || !result?.id) {
    console.error('[whop] plan creation failed', response.status, result?.message || result?.error)
    throw new Error('WHOP_PLAN_CREATE_FAILED')
  }
  return { planId: result.id }
}

export async function createWhopCheckout(planId: string, orderId: string) {
  const client = whopClient()
  const checkout = await client.checkoutConfigurations.create(
    { plan_id: planId, mode: 'payment', metadata: { order_id: orderId } },
    { headers: { 'Idempotency-Key': `dropverse-checkout-${orderId}` } },
  )
  if (!checkout?.id) throw new Error('WHOP_CHECKOUT_CREATE_FAILED')
  return { sessionId: checkout.id }
}
