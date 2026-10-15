/**
 * Public endpoint: guest customer completed SpaceRemit widget for an agency landing order.
 * - Verifies payment with SpaceRemit using private key (never trusts client alone).
 * - Confirms only when amount matches project client_price (retail), not fulfillment cost.
 * - Idempotent if already PAYMENT_CONFIRMED.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { type ProjectStatus } from '../../../../../lib/projectConfig'

const SPACEREMIT_INFO = 'https://spaceremit.com/api/v2/payment_info/'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const projectId = String(body.projectId || '').trim()
  const paymentId = String(body.paymentId || '').trim()
  const customerEmail = String(body.customerEmail || '').trim().toLowerCase()

  if (!projectId || !paymentId) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
  if (!privateKey || privateKey.startsWith('PLACEHOLDER') || privateKey.startsWith('SET_')) {
    const db = admin()
    const { data: attr } = await db
      .from('agency_order_attributions')
      .select('project_id, customer_email')
      .eq('project_id', projectId)
      .maybeSingle()
    if (!attr) return NextResponse.json({ error: 'NOT_AGENCY_ORDER' }, { status: 404 })
    if (customerEmail && attr.customer_email && attr.customer_email.toLowerCase() !== customerEmail) {
      return NextResponse.json({ error: 'EMAIL_MISMATCH' }, { status: 403 })
    }
    await db
      .from('projects')
      .update({ spaceremit_payment_id: paymentId })
      .eq('id', projectId)
      .neq('payment_status', 'PAYMENT_CONFIRMED')
    return NextResponse.json({
      success: true,
      confirmed: false,
      reason: 'SP_KEYS_MISSING',
      message: 'Payment reference saved. Confirmation requires configured SpaceRemit keys / webhook.',
    })
  }

  const db = admin()

  const { data: attr } = await db
    .from('agency_order_attributions')
    .select('project_id, customer_email, retail_price, currency')
    .eq('project_id', projectId)
    .maybeSingle()

  if (!attr) return NextResponse.json({ error: 'NOT_AGENCY_ORDER' }, { status: 404 })

  if (customerEmail && attr.customer_email && attr.customer_email.toLowerCase() !== customerEmail) {
    return NextResponse.json({ error: 'EMAIL_MISMATCH' }, { status: 403 })
  }

  const { data: project } = await db.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })

  if (project.payment_status === 'PAYMENT_CONFIRMED') {
    return NextResponse.json({ success: true, confirmed: true, already: true })
  }

  const spRes = await fetch(SPACEREMIT_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
  })
  let spData: {
    response_status?: string
    data?: { total_amount?: number | string; currency?: string; status?: string }
  } | null = null
  try {
    spData = await spRes.json()
  } catch {
    return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 502 })
  }
  if (spData?.response_status !== 'success' || !spData?.data) {
    return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 422 })
  }

  const tx = spData.data
  const expected = Number(project.client_price ?? attr.retail_price ?? 0)
  const paid = Number(tx.total_amount || 0)
  const currencyOk = !tx.currency || String(tx.currency).toUpperCase() === 'USD'
  if (!currencyOk || !(Math.abs(paid - expected) < 0.02)) {
    console.error('[agency-confirm] amount mismatch', { expected, paid, currency: tx.currency })
    return NextResponse.json({ error: 'SP_AMOUNT_MISMATCH' }, { status: 422 })
  }

  const now = new Date().toISOString()
  const status = (project.status || 'DRAFT') as ProjectStatus
  const nextStatus =
    status === 'DRAFT' || status === 'PAYMENT_PENDING' || status === 'PAST_DUE' ? 'PAYMENT_CONFIRMED' : status

  {
    const base = {
      payment_status: 'PAYMENT_CONFIRMED' as const,
      spaceremit_payment_id: paymentId,
      status: nextStatus,
    }
    let { error: upErr } = await db
      .from('projects')
      .update({ ...base, payment_confirmed_at: now })
      .eq('id', projectId)
    // Fallback if payment_confirmed_at column is absent on this DB.
    if (upErr) {
      ;({ error: upErr } = await db.from('projects').update(base).eq('id', projectId))
    }
    if (upErr) {
      console.error('[agency-confirm] update failed', upErr.message)
      return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
    }
  }

  await db.from('audit_logs').insert({
    actor_id: null,
    actor_email: attr.customer_email || customerEmail || null,
    action: 'agency_spaceremit_payment_confirmed',
    entity: 'project',
    entity_id: projectId,
    new_value: JSON.stringify({
      payment_id: paymentId,
      amount_usd: tx.total_amount,
      expected_retail: expected,
      source: 'agency_public_confirm',
    }),
  })

  return NextResponse.json({ success: true, confirmed: true })
}
