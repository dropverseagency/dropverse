import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

function verifySignature(rawBody: string, signature: string, secret: string) {
  const parts = Object.fromEntries(signature.split(';').map((part) => {
    const [key, ...value] = part.split('=')
    return [key, value.join('=')]
  }))
  const timestamp = parts.ts
  const received = parts.h1
  if (!timestamp || !received) return false
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret || secret.startsWith('ضع_هنا_') || secret.startsWith('YOUR_')) return NextResponse.json({ error: 'PADDLE_WEBHOOK_NOT_CONFIGURED' }, { status: 503 })

  const rawBody = await request.text()
  const signature = request.headers.get('paddle-signature') || ''
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  const event = JSON.parse(rawBody) as {
    event_id?: string
    event_type?: string
    data?: {
      id?: string
      status?: string
      customer_id?: string
      subscription_id?: string
      custom_data?: {
        dropverse_organization_id?: string
        dropverse_plan_id?: string
        dropverse_invoice_id?: string
        dropverse_project_id?: string
      }
    }
  }
  const transactionId = event.data?.id
  if (!transactionId) return NextResponse.json({ ok: true })

  const status = event.event_type === 'transaction.completed'
    ? 'completed'
    : event.event_type === 'transaction.payment_failed'
      ? 'payment_failed'
      : event.data?.status || 'updated'

  const admin = adminClient()
  const { error } = await admin
    .from('paddle_orders')
    .update({
      status,
      event_id: event.event_id ?? null,
      customer_id: event.data?.customer_id ?? null,
      subscription_id: event.data?.subscription_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('transaction_id', transactionId)
  if (error) {
    console.error('[paddle] webhook order update failed', error)
    return NextResponse.json({ error: 'ORDER_UPDATE_FAILED' }, { status: 500 })
  }

  if (event.event_type === 'transaction.completed' && event.data?.custom_data?.dropverse_organization_id && event.data.custom_data.dropverse_plan_id) {
    const { error: planError } = await admin
      .from('organizations')
      .update({ plan: event.data.custom_data.dropverse_plan_id, updated_at: new Date().toISOString() })
      .eq('id', event.data.custom_data.dropverse_organization_id)
    if (planError) console.error('[paddle] organization plan update failed', planError)
  }

  // Public invoice paid via International checkout
  if (event.event_type === 'transaction.completed' && event.data?.custom_data?.dropverse_invoice_id) {
    const invoiceId = event.data.custom_data.dropverse_invoice_id
    const projectId = event.data.custom_data.dropverse_project_id
    await admin
      .from('invoices')
      .update({ status: 'PAID' })
      .eq('id', invoiceId)
      .eq('status', 'PENDING')
    if (projectId) {
      await admin
        .from('projects')
        .update({
          payment_status: 'PAYMENT_CONFIRMED',
          payment_provider: 'PADDLE',
          payment_transaction_id: transactionId,
          payment_confirmed_at: new Date().toISOString(),
          status: 'PAYMENT_CONFIRMED',
        })
        .eq('id', projectId)
        .eq('payment_status', 'PAYMENT_PENDING')
    }
  }

  // Project paid via International from create-project
  if (event.event_type === 'transaction.completed' && event.data?.custom_data?.dropverse_project_id && !event.data.custom_data.dropverse_invoice_id) {
    const projectId = event.data.custom_data.dropverse_project_id
    await admin
      .from('projects')
      .update({
        payment_status: 'PAYMENT_CONFIRMED',
        payment_provider: 'PADDLE',
        payment_transaction_id: transactionId,
        payment_confirmed_at: new Date().toISOString(),
        status: 'PAYMENT_CONFIRMED',
      })
      .eq('id', projectId)
      .eq('payment_status', 'PAYMENT_PENDING')
  }

  return NextResponse.json({ ok: true })
}
