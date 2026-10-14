import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { planById, type PlanId } from '@/lib/planConfig'
import { DODO_API_BASE, dodoConfigured, dodoHeaders, dodoProductConfigured, dodoReturnUrl } from '@/lib/dodo'

export const runtime = 'nodejs'

const productEnvByPlan: Record<string, string | undefined> = {
  AGENCY: process.env.DODO_AGENCY_PRODUCT_ID,
  AGENCY_PRO: process.env.DODO_PRO_PRODUCT_ID,
}

export async function POST(request: Request) {
  if (!dodoConfigured()) return NextResponse.json({ error: 'DODO_NOT_CONFIGURED' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  const planId = String(body.planId || '') as PlanId
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : null
  const plan = planById(planId)
  const productId = productEnvByPlan[planId]
  if (!plan || plan.enterprise || plan.price <= 0) return NextResponse.json({ error: 'PLAN_NOT_PURCHASABLE' }, { status: 400 })
  if (!dodoProductConfigured(productId)) return NextResponse.json({ error: 'DODO_PLAN_PRODUCT_NOT_CONFIGURED' }, { status: 503 })

  const admin = adminClient()
  let userId: string | null = null
  let email: string | null = null
  try {
    const session = await sessionClient()
    const { data } = await session.auth.getUser()
    userId = data.user?.id ?? null
    email = data.user?.email ?? null
  } catch {}

  if (organizationId) {
    if (!userId) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
    const { data: membership } = await admin.from('organization_members').select('id').eq('organization_id', organizationId).eq('user_id', userId).eq('status', 'active').eq('role', 'OWNER').maybeSingle()
    if (!membership) return NextResponse.json({ error: 'BILLING_OWNER_REQUIRED' }, { status: 403 })
  }

  const response = await fetch(`${DODO_API_BASE}/checkouts`, {
    method: 'POST',
    headers: dodoHeaders(),
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: email ? { email } : undefined,
      return_url: dodoReturnUrl('/payment/success'),
      cancel_url: dodoReturnUrl('/pricing'),
      metadata: { dropverse_plan_id: plan.id, dropverse_organization_id: organizationId || 'none', dropverse_user_id: userId || 'guest' },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.checkout_url) {
    console.error('[dodo] plan checkout failed', payload)
    return NextResponse.json({ error: 'DODO_CHECKOUT_FAILED' }, { status: 502 })
  }

  const { error: orderError } = await admin.from('paddle_orders').insert({
    transaction_id: payload.payment_id || payload.session_id,
    organization_id: organizationId,
    user_id: userId,
    plan_id: plan.id,
    status: 'checkout_created',
    amount: plan.price,
    currency_code: plan.currency,
    customer_email: email,
    metadata: { provider: 'dodo', session_id: payload.session_id, plan_id: plan.id },
  })
  if (orderError) console.error('[dodo] plan order log failed', orderError)
  return NextResponse.json({ checkoutUrl: payload.checkout_url, sessionId: payload.session_id })
}
