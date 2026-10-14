import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

function verify(rawBody: string, request: Request, secret: string) {
  const id = request.headers.get('webhook-id') || ''
  const timestamp = request.headers.get('webhook-timestamp') || ''
  const signatureHeader = request.headers.get('webhook-signature') || ''
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!id || !timestamp || !Number.isFinite(age) || age > 300) return false
  const expected = createHmac('sha256', secret).update(`${id}.${timestamp}.${rawBody}`).digest('base64')
  return signatureHeader.split(' ').some((part) => {
    const received = part.split(',').pop() || ''
    const a = Buffer.from(expected)
    const b = Buffer.from(received)
    return a.length === b.length && timingSafeEqual(a, b)
  })
}

export async function POST(request: Request) {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET
  if (!secret || secret.startsWith('SET_') || secret.startsWith('YOUR_')) return NextResponse.json({ error: 'DODO_WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
  const rawBody = await request.text()
  if (!verify(rawBody, request, secret)) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })
  const event = JSON.parse(rawBody) as { type?: string; business_id?: string; data?: { payment_id?: string; subscription_id?: string; customer?: { customer_id?: string; email?: string }; metadata?: Record<string, string>; status?: string } }
  const data = event.data || {}
  const transactionId = data.payment_id || data.subscription_id
  if (!transactionId) return NextResponse.json({ ok: true })
  const status = event.type === 'payment.succeeded' || event.type === 'subscription.active' ? 'completed' : event.type?.replaceAll('.', '_') || data.status || 'updated'
  const metadata = data.metadata || {}
  const admin = adminClient()
  const { error } = await admin.from('paddle_orders').update({ status, customer_id: data.customer?.customer_id || null, customer_email: data.customer?.email || null, updated_at: new Date().toISOString() }).eq('transaction_id', transactionId)
  if (error) return NextResponse.json({ error: 'ORDER_UPDATE_FAILED' }, { status: 500 })
  if ((event.type === 'subscription.active' || event.type === 'payment.succeeded') && metadata.dropverse_organization_id && metadata.dropverse_plan_id && metadata.dropverse_organization_id !== 'none') {
    await admin.from('organizations').update({ plan: metadata.dropverse_plan_id, updated_at: new Date().toISOString() }).eq('id', metadata.dropverse_organization_id)
  }
  return NextResponse.json({ ok: true })
}
