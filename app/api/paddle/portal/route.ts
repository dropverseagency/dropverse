import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { paddleApiBase } from '@/lib/paddle'

export const runtime = 'nodejs'

export async function POST() {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PADDLE_NOT_CONFIGURED' }, { status: 503 })

  const session = await sessionClient()
  const { data, error } = await session.auth.getUser()
  if (error || !data.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const { data: order } = await adminClient()
    .from('paddle_orders')
    .select('customer_id, subscription_id')
    .eq('user_id', data.user.id)
    .not('customer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!order?.customer_id) return NextResponse.json({ error: 'NO_PADDLE_CUSTOMER' }, { status: 404 })

  const subscriptionIds = order.subscription_id ? [order.subscription_id] : []
  const response = await fetch(`${paddleApiBase()}/customers/${encodeURIComponent(order.customer_id)}/portal-sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Paddle-Version': '1',
    },
    body: JSON.stringify({ subscription_ids: subscriptionIds }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('[paddle] portal session failed', payload)
    return NextResponse.json({ error: 'PADDLE_PORTAL_FAILED' }, { status: 502 })
  }
  return NextResponse.json({ url: payload.data?.urls?.general?.overview ?? null })
}
