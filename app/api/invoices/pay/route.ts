import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseService'
import {
  STATUS_TRANSITIONS,
  type ProjectStatus,
} from '../../../../lib/projectConfig'

/**
 * Public invoice payment verification — NO authentication required.
 *
 * The client (on the public invoice page) sends the SpaceRemit transaction
 * code; we verify it directly with the SpaceRemit API. On success the invoice
 * is marked PAID and the linked project is promoted exactly like the normal
 * authenticated flow.
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
    return { ok: false, error: 'SPACEREMIT_API_ERROR', status: res.status }
  }
  const json = await res.json()
  // Normalizes both {"response_status":"success", "data":{...}} and flat shapes.
  const data = json?.data ?? json
  const status = String(json?.response_status ?? data?.status ?? '').toLowerCase()
  if (status !== 'success') {
    return { ok: false, error: 'SPACEREMIT_VERIFY_FAILED', detail: json }
  }
  return { ok: true, data }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    invoiceId?: string
    paymentId?: string
    clientName?: string
    clientEmail?: string
  }
  const invoiceId = String(body.invoiceId || '').trim()
  const paymentId = String(body.paymentId || '').trim()

  if (!invoiceId || !paymentId) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }
  const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
  if (!privateKey || privateKey.startsWith('PLACEHOLDER')) {
    return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
  }

  // 1. Load the invoice (any status, for a clear error message).
  const { data: invoice, error: getError } = await getServiceSupabase()
    .from('invoices')
    .select('id, project_id, status, amount, currency, spaceremit_payment_id')
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

  // 2. Verify the transaction code with SpaceRemit.
  const verification = await verifyWithSpaceRemit(privateKey, paymentId)
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error, detail: verification.detail },
      { status: 402 },
    )
  }

  // 2b. Cross-check amount & currency against the invoice amount.
  const expected = Number((invoice as any).amount || 0)
  const paid = Number(verification.data?.total_amount || 0)
  if (verification.data?.currency !== ((invoice as any).currency || 'USD') || !(Math.abs(paid - expected) < 0.01)) {
    return NextResponse.json({ error: 'SP_AMOUNT_MISMATCH' }, { status: 422 })
  }

  // 3. Mark the invoice PAID and record the transaction code.
  const { error: invError } = await getServiceSupabase()
    .from('invoices')
    .update({
      status: 'PAID',
      spaceremit_payment_id: paymentId,
      client_name: String(body.clientName || '').trim() || (invoice as any).client_name,
      client_email: String(body.clientEmail || '').trim() || (invoice as any).client_email,
    })
    .eq('id', invoiceId)

  if (invError) {
    console.error('invoice pay update error:', invError.message)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  // 4. Promote the linked project (same promotion as the authenticated flow).
  const projectId = (invoice as any).project_id
  const { data: project } = await getServiceSupabase()
    .from('projects')
    .select('user_id, status, payment_status, spaceremit_payment_id')
    .eq('id', projectId)
    .single()

  if (project && (project as any).payment_status === 'PAYMENT_PENDING') {
    // Advance through allowed status transitions, exactly like the
    // authenticated verify route.
    let currentStatus: ProjectStatus = ((project as any).status || 'DRAFT') as ProjectStatus
    const path: ProjectStatus[] = [currentStatus, 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED']
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      if (from === to) continue
      if (!STATUS_TRANSITIONS[from].includes(to)) {
        // Transition blocked — still mark the invoice PAID (payment was real).
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
        payment_provider: 'SPACEREMIT',
        payment_transaction_id: paymentId,
        spaceremit_payment_id: paymentId,
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    // Audit trail (best-effort, non-fatal).
    const auditInsert = getServiceSupabase().from('audit_logs').insert({
      actor_id: (project as any).user_id,
      action: 'spaceremit_payment_confirmed',
      entity: 'invoice',
      entity_id: invoiceId,
      new_value: JSON.stringify({
        payment_method: 'SPACEREMIT',
        payment_id: paymentId,
        project_id: projectId,
        amount_usd: verification.data?.total_amount,
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

  return NextResponse.json({ success: true, paymentId })
}
