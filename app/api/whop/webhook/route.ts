import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { adminClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

type WhopEvent = {
  type?: string
  data?: Record<string, unknown>
}

function nestedId(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : ''
  }
  return ''
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHOP_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 })

  const payload = await request.text()
  const headers = {
    'svix-id': request.headers.get('svix-id') || '',
    'svix-timestamp': request.headers.get('svix-timestamp') || '',
    'svix-signature': request.headers.get('svix-signature') || '',
  }
  let event: WhopEvent
  try {
    event = new Webhook(secret).verify(payload, headers) as WhopEvent
  } catch {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  const eventType = String(event.type || '')
  if (!['payment.succeeded', 'payment.succeeded.v1'].includes(eventType)) {
    return NextResponse.json({ received: true, ignored: true })
  }

  const data = event.data || {}
  const planId = nestedId(data.plan) || String(data.plan_id || '')
  const paymentId = String(data.id || data.payment_id || '')
  const amount = Number(data.final_amount ?? data.amount ?? data.total_amount ?? NaN)
  const currency = String(data.currency || 'usd').toUpperCase()
  if (!planId || !paymentId || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'INVALID_PAYMENT_PAYLOAD' }, { status: 400 })
  }

  const admin = adminClient()
  const { data: session, error } = await admin.from('whop_checkout_sessions')
    .select('id,plan_id,target_type,target_id,user_id,expected_amount,currency,status')
    .eq('plan_id', planId)
    .maybeSingle()
  if (error) {
    console.error('[whop webhook] session lookup failed', error.message)
    return NextResponse.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
  }
  if (!session) return NextResponse.json({ received: true, unmatched: true })
  if (session.status === 'paid') return NextResponse.json({ received: true, duplicate: true })
  if (currency !== session.currency || Math.abs(amount - Number(session.expected_amount)) >= 0.01) {
    console.error('[whop webhook] amount/currency mismatch', { planId, amount, currency })
    return NextResponse.json({ error: 'PAYMENT_MISMATCH' }, { status: 422 })
  }

  // Claim this event idempotently before changing the linked purchase.
  const { data: claimed, error: claimError } = await admin.from('whop_checkout_sessions')
    .update({ status: 'paid', provider_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (claimError) {
    console.error('[whop webhook] claim failed', claimError.message)
    return NextResponse.json({ error: 'CLAIM_FAILED' }, { status: 500 })
  }
  if (!claimed) return NextResponse.json({ received: true, duplicate: true })

  if (session.target_type === 'project') {
    const { error: updateError } = await admin.from('projects')
      .update({ payment_status: 'PAYMENT_CONFIRMED', status: 'PAYMENT_CONFIRMED', payment_provider: 'WHOP' })
      .eq('id', session.target_id)
      .eq('user_id', session.user_id)
      .neq('payment_status', 'PAYMENT_CONFIRMED')
    if (updateError) {
      console.error('[whop webhook] project update failed', updateError.message)
      return NextResponse.json({ error: 'PROJECT_UPDATE_FAILED' }, { status: 500 })
    }
  } else if (session.target_type === 'lead_pack') {
    const { error: confirmError } = await admin.rpc('whop_confirm_lead_pack_purchase', {
      p_purchase_id: session.target_id,
      p_payment_id: paymentId,
    })
    if (confirmError) {
      console.error('[whop webhook] lead pack confirmation failed', confirmError.message)
      return NextResponse.json({ error: 'LEAD_PACK_CONFIRM_FAILED' }, { status: 500 })
    }
  } else if (session.target_type === 'subscription') {
    const { error: subscriptionError } = await admin.rpc('whop_confirm_subscription', {
      p_user_id: session.user_id,
      p_target_id: session.target_id,
      p_payment_id: paymentId,
    })
    if (subscriptionError) {
      console.error('[whop webhook] subscription sync failed', subscriptionError.message)
      return NextResponse.json({ error: 'SUBSCRIPTION_SYNC_FAILED' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
