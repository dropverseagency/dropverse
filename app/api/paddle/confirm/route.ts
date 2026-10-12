import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'
import { paddleApiBase } from '@/lib/paddle'

export const runtime = 'nodejs'

/**
 * Client-side confirmation after Paddle checkout.completed.
 * Fetches the transaction from Paddle API and marks project/invoice paid.
 * Complements webhooks (works even if webhook secret is missing or delayed).
 */
export async function POST(request: Request) {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'PADDLE_NOT_CONFIGURED' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : ''
  if (!transactionId || !transactionId.startsWith('txn_')) {
    return NextResponse.json({ error: 'TRANSACTION_REQUIRED' }, { status: 400 })
  }

  const txnRes = await fetch(`${paddleApiBase()}/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Paddle-Version': '1',
    },
  })
  const txnPayload = await txnRes.json().catch(() => ({}))
  if (!txnRes.ok) {
    return NextResponse.json({
      error: (txnPayload as { error?: { detail?: string } })?.error?.detail || 'TRANSACTION_FETCH_FAILED',
    }, { status: 502 })
  }

  const transaction = (txnPayload as { data?: {
    id?: string
    status?: string
    customer_id?: string
    subscription_id?: string
    custom_data?: {
      dropverse_organization_id?: string
      dropverse_plan_id?: string
      dropverse_invoice_id?: string
      dropverse_project_id?: string
      dropverse_sample_id?: string
    }
  } }).data

  if (!transaction?.id) {
    return NextResponse.json({ error: 'TRANSACTION_NOT_FOUND' }, { status: 404 })
  }

  const status = String(transaction.status || '').toLowerCase()
  const isPaid = status === 'completed' || status === 'paid' || status === 'billed'
  if (!isPaid) {
    return NextResponse.json({
      ok: true,
      paid: false,
      status: transaction.status,
      message: 'Transaction is not completed yet.',
    })
  }

  const admin = adminClient()
  const custom = transaction.custom_data || {}

  await admin.from('paddle_orders').update({
    status: 'completed',
    customer_id: transaction.customer_id ?? null,
    subscription_id: transaction.subscription_id ?? null,
    updated_at: new Date().toISOString(),
  }).eq('transaction_id', transaction.id)

  if (custom.dropverse_organization_id && custom.dropverse_plan_id) {
    await admin
      .from('organizations')
      .update({ plan: custom.dropverse_plan_id, updated_at: new Date().toISOString() })
      .eq('id', custom.dropverse_organization_id)
  }

  if (custom.dropverse_invoice_id) {
    await admin
      .from('invoices')
      .update({ status: 'PAID' })
      .eq('id', custom.dropverse_invoice_id)
      .eq('status', 'PENDING')
  }

  if (custom.dropverse_project_id) {
    await admin
      .from('projects')
      .update({
        payment_status: 'PAYMENT_CONFIRMED',
        payment_provider: 'PADDLE',
        payment_transaction_id: transaction.id,
        payment_confirmed_at: new Date().toISOString(),
        status: 'PAYMENT_CONFIRMED',
      })
      .eq('id', custom.dropverse_project_id)
      .eq('payment_status', 'PAYMENT_PENDING')
  }

  return NextResponse.json({
    ok: true,
    paid: true,
    transactionId: transaction.id,
    projectId: custom.dropverse_project_id ?? null,
    invoiceId: custom.dropverse_invoice_id ?? null,
  })
}
