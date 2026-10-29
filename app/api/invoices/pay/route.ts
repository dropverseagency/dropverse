import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseService'
import {
  STATUS_TRANSITIONS,
  type ProjectStatus,
} from '../../../../lib/projectConfig'
import { notifyAdminEvent } from '@/lib/agents/adminNotify'
import { recordFunnelEvent } from '@/lib/funnel'
import { verifyPayPalOrder } from '../../../../lib/paypalVerification'

/**
 * Public invoice payment verification — NO authentication required.
 *
 * Supports:
 * - SpaceRemit: client sends transaction code; we verify with SpaceRemit API.
 * - PayPal: client sends the order ID; the server confirms it with the PayPal
 *   Orders API. Missing credentials or any verification failure rejects payment.
 */
let serviceSupabase: ReturnType<typeof createServiceClient> | null = null
function getServiceSupabase() {
  return (serviceSupabase ??= createServiceClient())
}

async function verifyWithSpaceRemit(privateKey: string, paymentId: string) {
  const res = await fetch('https://spaceremit.com/api/v2/payment_info/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
  })
  if (!res.ok) {
    return { ok: false as const, error: 'SPACEREMIT_API_ERROR', status: res.status }
  }
  const json = await res.json()
  const data = json?.data ?? json
  const responseStatus = String(json?.response_status ?? '').toLowerCase()
  if (responseStatus !== 'success') {
    return { ok: false as const, error: 'SPACEREMIT_VERIFY_FAILED' }
  }
  const paymentStatus = String(data?.status || '').toUpperCase()
  if (!['SUCCESS', 'CONFIRMED', 'COMPLETED'].includes(paymentStatus)) {
    return { ok: false as const, error: 'SPACEREMIT_PAYMENT_NOT_COMPLETE' }
  }
  return { ok: true as const, data }
}

async function getPayPalAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || ''
  const secret = process.env.PAYPAL_CLIENT_SECRET || ''
  if (!clientId || !secret || clientId === 'test') return null

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const base =
    process.env.PAYPAL_API_BASE ||
    (clientId.startsWith('A') ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null
  const json = (await res.json()) as { access_token?: string }
  return json.access_token || null
}

async function verifyWithPayPal(orderId: string, expectedAmount: number, expectedCurrency: string, invoiceId: string) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || ''
  const base =
    process.env.PAYPAL_API_BASE ||
    (clientId.startsWith('A') ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

  return verifyPayPalOrder(orderId, expectedAmount, expectedCurrency, `dv:invoice:${invoiceId}:${expectedAmount.toFixed(2)}`, {
    getAccessToken: getPayPalAccessToken,
    fetchOrder: (id, token) => fetch(`${base}/v2/checkout/orders/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }),
  })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    invoiceId?: string
    paymentId?: string
    provider?: string
    clientName?: string
    clientEmail?: string
  }
  const invoiceId = String(body.invoiceId || '').trim()
  const paymentId = String(body.paymentId || '').trim()
  const provider = String(body.provider || 'spaceremit').toLowerCase()

  if (!invoiceId || !paymentId) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  const { data: invoice, error: getError } = await getServiceSupabase()
    .from('invoices')
    .select('id, project_id, status, amount, currency, spaceremit_payment_id, kind, revision_request_id')
    .eq('id', invoiceId)
    .single()

  if (getError || !invoice) {
    return NextResponse.json({ error: 'INVOICE_NOT_FOUND' }, { status: 404 })
  }
  if ((invoice as any).status !== 'PENDING') {
    return NextResponse.json(
      { error: 'INVOICE_NOT_PAYABLE', status: (invoice as any).status },
      { status: 400 },
    )
  }

  const expectedAmount = Number((invoice as any).amount || 0)
  const expectedCurrency = String((invoice as any).currency || 'USD').toUpperCase()

  const { data: consent } = await getServiceSupabase()
    .from('audit_logs')
    .select('id, new_value')
    .eq('action', 'checkout_terms_accepted')
    .eq('entity', 'invoice')
    .eq('entity_id', invoiceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const consentValue = consent?.new_value as Record<string, unknown> | null
  if (!consent || consentValue?.accepted !== true || consentValue?.terms_version !== '2026-10-23' ||
      consentValue?.item_id !== invoiceId || Number(consentValue?.amount) !== expectedAmount ||
      String(consentValue?.currency || '').toUpperCase() !== expectedCurrency) {
    return NextResponse.json({ error: 'TERMS_ACCEPTANCE_REQUIRED' }, { status: 400 })
  }

  let paymentMethod: 'SPACEREMIT' | 'PAYPAL' = 'SPACEREMIT'
  let verifiedAmount: number | undefined

  if (provider === 'paypal') {
    paymentMethod = 'PAYPAL'
    const verification = await verifyWithPayPal(paymentId, expectedAmount, expectedCurrency, invoiceId)
    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.error, detail: (verification as any).detail },
        { status: verification.error === 'SP_AMOUNT_MISMATCH' ? 422 : 402 },
      )
    }
    verifiedAmount = verification.data.amount
  } else {
    const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
    if (!privateKey || privateKey.startsWith('PLACEHOLDER')) {
      return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
    }
    const verification = await verifyWithSpaceRemit(privateKey, paymentId)
    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.error, detail: verification.detail },
        { status: 402 },
      )
    }
    const paid = Number(verification.data?.total_amount)
    const paidCurrency = String(verification.data?.currency || '').toUpperCase()
    if (!(expectedAmount > 0) || !Number.isFinite(paid) || paidCurrency !== expectedCurrency || Math.abs(paid - expectedAmount) >= 0.01) {
      return NextResponse.json({ error: 'SP_AMOUNT_MISMATCH' }, { status: 422 })
    }
    verifiedAmount = paid
  }

  // One verified provider transaction can be used for only one invoice/project.
  const { data: transactionClaimed, error: transactionClaimError } = await getServiceSupabase().rpc('claim_payment_transaction', {
    p_provider: paymentMethod,
    p_transaction_id: paymentId,
    p_entity_type: 'invoice',
    p_entity_id: invoiceId,
  })
  if (transactionClaimError) {
    console.error('payment transaction claim failed:', transactionClaimError.message)
    return NextResponse.json({ error: 'PAYMENT_CLAIM_FAILED' }, { status: 500 })
  }
  if (transactionClaimed !== true) {
    return NextResponse.json({ error: 'PAYMENT_TRANSACTION_ALREADY_USED' }, { status: 409 })
  }

  // Compare-and-set prevents concurrent requests from confirming the same invoice twice.
  const { data: paidInvoice, error: invError } = await getServiceSupabase()
    .from('invoices')
    .update({
      status: 'PAID',
      spaceremit_payment_id: paymentMethod === 'SPACEREMIT' ? paymentId : (invoice as any).spaceremit_payment_id,
    })
    .eq('id', invoiceId)
    .eq('status', 'PENDING')
    .select('id')
    .maybeSingle()

  if (invError) {
    console.error('invoice pay update error:', invError.message)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }
  if (!paidInvoice) return NextResponse.json({ error: 'INVOICE_ALREADY_PROCESSED' }, { status: 409 })

  const projectId = (invoice as any).project_id
  await recordFunnelEvent('payment_completed',{projectId,invoiceId,amountUsd:verifiedAmount,metadata:{provider:paymentMethod,kind:(invoice as any).kind||'project'}})
  if ((invoice as any).kind === 'revision' && (invoice as any).revision_request_id) {
    await getServiceSupabase().from('project_revision_requests').update({ payment_status: 'paid', status: 'in_progress' }).eq('id', (invoice as any).revision_request_id)
    await getServiceSupabase().from('projects').update({ operations_status: 'revision_requested' }).eq('id', projectId)
    await getServiceSupabase().from('project_events').insert({ project_id: projectId, actor_kind: 'client', event_type: 'revision_payment_confirmed', metadata: { invoiceId, revisionId: (invoice as any).revision_request_id, provider: paymentMethod, amount: verifiedAmount } })
    return NextResponse.json({ success: true, kind: 'revision' })
  }
  const { data: project } = await getServiceSupabase()
    .from('projects')
    .select('user_id, status, payment_status, spaceremit_payment_id')
    .eq('id', projectId)
    .single()

  if (project && (project as any).payment_status === 'PAYMENT_PENDING') {
    let currentStatus: ProjectStatus = ((project as any).status || 'DRAFT') as ProjectStatus
    const path: ProjectStatus[] = [currentStatus, 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED']
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      if (from === to) continue
      if (!STATUS_TRANSITIONS[from].includes(to)) {
        break
      }
      await getServiceSupabase()
        .from('projects')
        .update({ status: to, payment_status: to })
        .eq('id', projectId)
      currentStatus = to
    }
    await getServiceSupabase()
      .from('projects')
      .update({
        payment_status: 'PAYMENT_CONFIRMED',
        payment_provider: paymentMethod,
        payment_transaction_id: paymentId,
        spaceremit_payment_id: paymentMethod === 'SPACEREMIT' ? paymentId : (project as any).spaceremit_payment_id,
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    const auditInsert = getServiceSupabase().from('audit_logs').insert({
      actor_id: (project as any).user_id,
      action: paymentMethod === 'PAYPAL' ? 'paypal_payment_confirmed' : 'spaceremit_payment_confirmed',
      entity: 'invoice',
      entity_id: invoiceId,
      new_value: JSON.stringify({
        payment_method: paymentMethod,
        payment_id: paymentId,
        project_id: projectId,
        amount_usd: verifiedAmount,
      }),
    })
    void (async () => {
      try {
        await auditInsert
      } catch (e: unknown) {
        console.error('audit log failed:', e)
      }
    })()
  }

  void notifyAdminEvent({
    agent: 'invoice_payment',
    idempotencyKey: `invoice_pay:${invoiceId}:${paymentId}`,
    entityId: invoiceId,
    title: 'Invoice / project payment confirmed',
    lines: [
      `Invoice: ${invoiceId}`,
      `Provider: ${paymentMethod}`,
      `Amount: $${verifiedAmount ?? '—'}`,
      `Payment id: ${paymentId}`,
    ],
    adminPath: '/admin',
  })

  return NextResponse.json({ success: true, paymentId, provider: paymentMethod })
}
