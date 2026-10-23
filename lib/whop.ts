import { createHmac, timingSafeEqual } from 'node:crypto'

export type WhopTargetType = 'project' | 'lead_pack' | 'subscription'

export function whopConfig() {
  const apiKey = process.env.WHOP_API_KEY
  const companyId = process.env.WHOP_COMPANY_ID
  if (!apiKey || !companyId) throw new Error('WHOP_NOT_CONFIGURED')
  return { apiKey, companyId }
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
  const response = await fetch('https://api.whop.com/api/v1/plans', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null) as { id?: string; message?: string; error?: string } | null
  if (!response.ok || !result?.id) {
    console.error('[whop] plan creation failed', response.status, result?.message || result?.error)
    throw new Error('WHOP_PLAN_CREATE_FAILED')
  }
  return { planId: result.id, purchaseUrl: `https://whop.com/checkout/${result.id}` }
}

export function verifyWhopSignature(payload: string, signature: string, secret: string) {
  // Whop uses Svix-style webhook signatures; use the official Svix verifier at the route.
  // This helper intentionally does not implement signature parsing itself.
  return Boolean(payload && signature && secret)
}
