/**
 * SpaceRemit payment callback (webhook) endpoint.
 *
 * SpaceRemit POSTs a JSON payload to this URL whenever a payment status
 * changes or completes. We verify the caller with our private key via the
 * payment_info API, match the payment to a pending project / invoice /
 * org plan in our database, and confirm it automatically.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { STATUS_TRANSITIONS, type ProjectStatus } from '../../../../lib/projectConfig'

const SPACEREMIT_INFO = 'https://spaceremit.com/api/v2/payment_info/'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: fetch as unknown as typeof globalThis.fetch } },
  )
}

/** Try to confirm a project paid with SpaceRemit. Returns true if matched. */
async function confirmProject(supabase: ReturnType<typeof serviceClient>, paymentId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('spaceremit_payment_id', paymentId)
    .neq('payment_status', 'PAYMENT_CONFIRMED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!project) return false
  const path: ProjectStatus[] = [
    (project.status || 'DRAFT') as ProjectStatus,
    'PAYMENT_PENDING',
    'PAYMENT_CONFIRMED',
  ]
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] === path[i + 1]) continue
    if (!STATUS_TRANSITIONS[path[i]].includes(path[i + 1])) return false
    await supabase.from('projects').update({ status: path[i + 1], payment_status: path[i + 1] }).eq('id', project.id)
  }
  await supabase
    .from('projects')
    .update({ payment_status: 'PAYMENT_CONFIRMED', spaceremit_payment_id: paymentId })
    .eq('id', project.id)
  await supabase.from('audit_logs').insert({
    actor_id: project.user_id,
    actor_email: null,
    action: 'spaceremit_payment_confirmed_callback',
    entity: 'project',
    entity_id: project.id,
    new_value: JSON.stringify({ payment_id: paymentId, source: 'callback' }),
  })
  return true
}

/** Try to confirm an invoice paid with SpaceRemit. Returns true if matched. */
async function confirmInvoice(supabase: ReturnType<typeof serviceClient>, paymentId: string) {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('spaceremit_payment_id', paymentId)
    .neq('status', 'PAID')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!invoice) return false
  await supabase
    .from('invoices')
    .update({ status: 'PAID', spaceremit_payment_id: paymentId })
    .eq('id', invoice.id)
  if (invoice.project_id) {
    await supabase
      .from('projects')
      .update({ payment_status: 'PAYMENT_CONFIRMED' })
      .eq('id', invoice.project_id)
      .eq('payment_status', 'PAYMENT_PENDING')
  }
  await supabase.from('audit_logs').insert({
    actor_id: invoice.user_id ?? null,
    actor_email: null,
    action: 'spaceremit_payment_confirmed_callback',
    entity: 'invoice',
    entity_id: invoice.id,
    new_value: JSON.stringify({ payment_id: paymentId, source: 'callback' }),
  })
  return true
}

/** Try to confirm an org plan paid with SpaceRemit. Returns true if matched. */
async function confirmOrgPlan(supabase: ReturnType<typeof serviceClient>, paymentId: string) {
  // Plan payments are stored directly on the organization row when paid
  // via the dashboard banner (spaceremit_plan_confirmed audit already logs it).
  // There is no separate plan_payments table yet — match via audit trail is
  // not needed since the in-app verify route already updated the org plan.
  return false
}

export async function POST(request: NextRequest) {
  // 1. Keys must be real before accepting any webhook.
  const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
  if (!privateKey || privateKey.startsWith('PLACEHOLDER')) {
    return NextResponse.json({ status: 'keys_missing' }, { status: 503 })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'invalid_json' }, { status: 400 })
  }

  // SpaceRemit callbacks carry payment details; the authoritative check is
  // done server-side via payment_info with our private key.
  const paymentId = String(
    body?.payment_id || body?.transaction_id || body?.data?.payment_id || body?.data?.transaction_id || '',
  ).trim()
  if (!paymentId) {
    return NextResponse.json({ status: 'no_payment_id' }, { status: 400 })
  }

  const spRes = await fetch(SPACEREMIT_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
  })
  let spData: any = null
  try {
    spData = await spRes.json()
  } catch {
    return NextResponse.json({ status: 'sp_verify_failed' }, { status: 502 })
  }
  if (spData?.response_status !== 'success' || !spData?.data) {
    return NextResponse.json({ status: 'sp_verify_failed' }, { status: 422 })
  }
  const tx = spData.data
  const txStatus = String(tx?.status || '').toUpperCase()
  if (txStatus !== 'SUCCESS' && txStatus !== 'CONFIRMED' && txStatus !== 'COMPLETED') {
    return NextResponse.json({ status: 'payment_not_complete', sp_status: tx.status })
  }

  const supabase = serviceClient()
  const matched =
    (await confirmProject(supabase, paymentId)) ||
    (await confirmInvoice(supabase, paymentId)) ||
    (await confirmOrgPlan(supabase, paymentId))

  return NextResponse.json({
    status: matched ? 'confirmed' : 'no_match',
    sp_status: tx.status,
  })
}
