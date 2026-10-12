import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { planById, type PlanId } from '@/lib/planConfig'
import { paddleApiBase, paddleCheckoutPayload } from '@/lib/paddle'

export const runtime = 'nodejs'

function paddleErrorMessage(payload: unknown): string {
  const error = (payload as { error?: { code?: string; detail?: string } })?.error
  if (!error) return 'PADDLE_TRANSACTION_FAILED'
  if (error.code === 'transaction_default_checkout_url_not_set') {
    return 'Set Default payment link in Paddle → Checkout → Checkout settings to https://dropverse-nu.vercel.app/pricing then retry.'
  }
  if (error.code === 'transaction_checkout_url_domain_is_not_approved' || /domain that has been approved/i.test(error.detail || '')) {
    return 'Paddle rejected the return URL domain. Set Default payment link in Paddle and clear NEXT_PUBLIC_PADDLE_CHECKOUT_URL if set.'
  }
  return error.detail || error.code || 'PADDLE_TRANSACTION_FAILED'
}

export async function POST(request: Request) {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PADDLE_NOT_CONFIGURED' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const planId = String(body.planId || '') as PlanId
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : null
  const plan = planById(planId)
  if (!plan || plan.enterprise || plan.price <= 0) {
    return NextResponse.json({ error: 'PLAN_NOT_PURCHASABLE' }, { status: 400 })
  }

  const admin = adminClient()
  let userId: string | null = null
  let email: string | null = null
  try {
    const session = await sessionClient()
    const { data } = await session.auth.getUser()
    userId = data.user?.id ?? null
    email = data.user?.email ?? null
  } catch {
    // Guests can still complete checkout; an account can be linked later by email.
  }

  if (organizationId) {
    if (!userId) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
    const { data: membership } = await admin
      .from('organization_members')
      .select('id, role, status')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('role', 'OWNER')
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'BILLING_OWNER_REQUIRED' }, { status: 403 })
  }

  const checkout = paddleCheckoutPayload()

  const transactionResponse = await fetch(`${paddleApiBase()}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Paddle-Version': '1',
    },
    body: JSON.stringify({
      collection_mode: 'automatic',
      ...(checkout ? { checkout } : {}),
      items: [{
        quantity: 1,
        price: {
          description: `${plan.displayName} workspace subscription`,
          name: `DropVerse ${plan.displayName}`,
          product: { name: `DropVerse ${plan.displayName}`, tax_category: 'saas' },
          unit_price: { amount: String(Math.round(plan.price * 100)), currency_code: plan.currency },
          billing_cycle: { interval: 'month', frequency: 1 },
          tax_mode: 'account_setting',
        },
      }],
      custom_data: {
        dropverse_plan_id: plan.id,
        dropverse_organization_id: organizationId,
        dropverse_user_id: userId,
      },
      ...(email ? { customer: { email } } : {}),
    }),
  })
  const transactionPayload = await transactionResponse.json().catch(() => ({}))
  if (!transactionResponse.ok) {
    console.error('[paddle] plan transaction creation failed', transactionPayload)
    return NextResponse.json({
      error: paddleErrorMessage(transactionPayload),
      code: (transactionPayload as { error?: { code?: string } })?.error?.code ?? 'PADDLE_TRANSACTION_FAILED',
      detail: transactionPayload,
    }, { status: 502 })
  }

  const transaction = transactionPayload.data
  const { error: orderError } = await admin.from('paddle_orders').insert({
    transaction_id: transaction.id,
    organization_id: organizationId,
    user_id: userId,
    plan_id: plan.id,
    status: transaction.status || 'draft',
    amount: plan.price,
    currency_code: plan.currency,
    customer_email: email,
    metadata: { source: 'pricing_or_billing', plan_id: plan.id },
  })
  if (orderError) {
    console.error('[paddle] plan order log failed', orderError)
    return NextResponse.json({ error: 'ORDER_LOG_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ transactionId: transaction.id, checkoutUrl: transaction.checkout?.url ?? null })
}
