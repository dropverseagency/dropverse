import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { DODO_API_BASE, dodoConfigured, dodoHeaders, dodoReturnUrl } from '@/lib/dodo'

export const runtime = 'nodejs'

export async function POST() {
  if (!dodoConfigured()) return NextResponse.json({ error: 'DODO_NOT_CONFIGURED' }, { status: 503 })
  const session = await sessionClient()
  const { data, error } = await session.auth.getUser()
  if (error || !data.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  const { data: order } = await adminClient().from('paddle_orders').select('customer_id, customer_email').eq('user_id', data.user.id).not('customer_id', 'is', null).order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (!order?.customer_id) return NextResponse.json({ error: 'NO_DODO_CUSTOMER' }, { status: 404 })
  const response = await fetch(`${DODO_API_BASE}/customers/${encodeURIComponent(order.customer_id)}/customer-portal/session?return_url=${encodeURIComponent(dodoReturnUrl('/dashboard/billing'))}`, { method: 'POST', headers: dodoHeaders() })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.link) return NextResponse.json({ error: 'DODO_PORTAL_FAILED' }, { status: 502 })
  return NextResponse.json({ url: payload.link })
}
