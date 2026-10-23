import { NextRequest, NextResponse } from 'next/server'
import { whopClient } from '@/lib/whop'
import { adminClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

type WhopEvent = { type?: string; data?: Record<string, unknown> }

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
function nestedId(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return readString((value as { id?: unknown }).id)
  return ''
}
function readOrderId(data: Record<string, unknown>): string {
  const metadata = data.metadata
  if (!metadata || typeof metadata !== 'object') return ''
  return readString((metadata as Record<string, unknown>).order_id)
}

export async function POST(request: NextRequest) {
  if (!process.env.WHOP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
  }

  const raw = await request.text()
  const headers = Object.fromEntries(request.headers.entries())
  let event: WhopEvent
  try {
    event = whopClient().webhooks.unwrap(raw, { headers }) as unknown as WhopEvent
  } catch {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })
  }

  if (event.type !== 'payment.succeeded') return NextResponse.json({ received: true, ignored: true })
  const data = event.data || {}
  const paymentId = readString(data.id)
  const orderId = readOrderId(data)
  if (!paymentId || !orderId) return NextResponse.json({ error: 'MISSING_PAYMENT_OR_ORDER_ID' }, { status: 400 })

  const admin = adminClient()
  const { data: session, error: lookupError } = await admin.from('whop_checkout_sessions')
    .select('id,plan_id,target_type,target_id,user_id,expected_amount,currency,status,provider_payment_id')
    .eq('id', orderId).maybeSingle()
  if (lookupError) {
    console.error('[whop webhook] session lookup failed', lookupError.message)
    return NextResponse.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
  }
  if (!session) return NextResponse.json({ received: true, unmatched: true })
  if (session.status === 'paid') return NextResponse.json({ received: true, duplicate: true })

  let payment: Record<string, unknown>
  try {
    payment = await whopClient().payments.retrieve(paymentId) as unknown as Record<string, unknown>
  } catch (error) {
    console.error('[whop webhook] payment retrieval failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'PAYMENT_NOT_VERIFIED' }, { status: 502 })
  }

  const paymentPlanId = nestedId(payment.plan) || readString(payment.plan_id)
  const substatus = readString(payment.substatus)
  const amount = Number(payment.final_amount ?? payment.amount ?? payment.total_amount ?? NaN)
  const currency = readString(payment.currency).toUpperCase()
  const paymentOrderId = readOrderId(payment)
  if (substatus !== 'succeeded' || paymentPlanId !== session.plan_id || (paymentOrderId && paymentOrderId !== session.id)) {
    return NextResponse.json({ error: 'PAYMENT_NOT_VERIFIED' }, { status: 422 })
  }
  if (!Number.isFinite(amount) || Math.abs(amount - Number(session.expected_amount)) >= 0.01 ||
      (currency && currency !== session.currency)) {
    console.error('[whop webhook] amount/currency mismatch', { orderId, amount, currency })
    return NextResponse.json({ error: 'PAYMENT_MISMATCH' }, { status: 422 })
  }

  // Process the linked purchase first. Target updates are idempotent so Whop retries are safe.
  if (session.target_type === 'project') {
    const { error } = await admin.from('projects')
      .update({ payment_status: 'PAYMENT_CONFIRMED', status: 'PAYMENT_CONFIRMED', payment_provider: 'WHOP' })
      .eq('id', session.target_id).eq('user_id', session.user_id)
    if (error) {
      console.error('[whop webhook] project update failed', error.message)
      return NextResponse.json({ error: 'PROJECT_UPDATE_FAILED' }, { status: 500 })
    }
  } else if (session.target_type === 'lead_pack') {
    const { error } = await admin.rpc('whop_confirm_lead_pack_purchase', {
      p_purchase_id: session.target_id, p_payment_id: paymentId,
    })
    if (error) {
      console.error('[whop webhook] lead pack confirmation failed', error.message)
      return NextResponse.json({ error: 'LEAD_PACK_CONFIRM_FAILED' }, { status: 500 })
    }
  } else if (session.target_type === 'subscription') {
    const planId = readString(paymentPlanId)
    const plan = planId === process.env.NEXT_PUBLIC_WHOP_AGENCY_MONTHLY_PLAN_ID
      ? 'AGENCY'
      : planId === process.env.NEXT_PUBLIC_WHOP_AGENCY_PRO_MONTHLY_PLAN_ID
        ? 'AGENCY_PRO'
        : null
    if (!plan) return NextResponse.json({ error: 'UNKNOWN_SUBSCRIPTION_PLAN' }, { status: 422 })
    const { error } = await admin.from('organizations')
      .update({ plan })
      .eq('id', session.target_id).eq('owner_id', session.user_id)
    if (error) {
      console.error('[whop webhook] subscription update failed', error.message)
      return NextResponse.json({ error: 'SUBSCRIPTION_SYNC_FAILED' }, { status: 500 })
    }
  }

  const { error: markError } = await admin.from('whop_checkout_sessions')
    .update({ status: 'paid', provider_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq('id', session.id).eq('status', 'pending')
  if (markError) {
    console.error('[whop webhook] mark-paid failed', markError.message)
    return NextResponse.json({ error: 'SESSION_UPDATE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
