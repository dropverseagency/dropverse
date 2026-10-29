'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { adminClient } from '@/lib/adminCore'
import { cookies } from 'next/headers'

import { notifyAdminEvent } from '@/lib/agents/adminNotify'
import { createUserNotification } from '@/lib/userNotifications'

/**
 * Confirms a SpaceRemit payment and promotes the project status —
 * server-side ONLY. The client sends the transaction code, we verify it
 * directly with the SpaceRemit API before touching the database.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  const isAdmin = user.id === process.env.ADMIN_USER_ID
  const body = (await request.json()) as {
    paymentId?: string
    projectId?: string
  }

  const paymentId = String(body.paymentId || '').trim()
  const projectId = String(body.projectId || '').trim()

  if (!paymentId || !projectId) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  // Keys must be real (configured after SpaceRemit verification).
  const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
  if (!privateKey || privateKey.startsWith('PLACEHOLDER')) {
    return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
  }

  // 1. Own the project (non-admin) before anything else.
  const { data: project, error: getError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (getError || !project) {
    return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  }
  if (project.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'NOT_ALLOWED' }, { status: 403 })
  }
  if (project.payment_method !== 'SPACEREMIT') {
    return NextResponse.json({ error: 'WRONG_PAYMENT_METHOD' }, { status: 400 })
  }
  if (project.payment_status === 'PAYMENT_CONFIRMED') {
    return NextResponse.json({ error: 'ALREADY_CONFIRMED' }, { status: 400 })
  }

  // 2. Verify the transaction directly with SpaceRemit (never trust the client).
  const spRes = await fetch('https://spaceremit.com/api/v2/payment_info/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
  })
  let spData: any = null
  try {
    spData = await spRes.json()
  } catch {
    return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 502 })
  }
  if (spData?.response_status !== 'success' || !spData?.data) {
    return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 422 })
  }
  const tx = spData.data
  const txStatus = String(tx?.status || '').toUpperCase()
  if (!['SUCCESS', 'CONFIRMED', 'COMPLETED'].includes(txStatus)) {
    return NextResponse.json({ error: 'PAYMENT_NOT_COMPLETE' }, { status: 402 })
  }

  // 3. Cross-check amount & currency against the project's fulfillment cost.
  const expected = Number(project.fulfillment_cost || 0)
  const paid = Number(tx.total_amount)
  const currency = String(tx.currency || '').toUpperCase()
  if (!(expected > 0) || !Number.isFinite(paid) || currency !== 'USD' || Math.abs(paid - expected) >= 0.01) {
    void notifyAdminEvent({
      agent: 'payment_failed',
      idempotencyKey: `payment_fail:spaceremit:mismatch:${projectId}:${paymentId}`,
      entityId: projectId,
      title: 'Payment verify failed (amount mismatch)',
      lines: [`Project: ${projectId}`, `Expected: $${expected}`, `Paid: $${paid} ${tx.currency}`],
      adminPath: '/admin',
    })
    return NextResponse.json({ error: 'SP_AMOUNT_MISMATCH' }, { status: 422 })
  }

  // 4. Claim this transaction globally before attaching it to a project.
  // The database RPC is idempotent for this project and rejects reuse elsewhere.
  const { data: claimed, error: claimError } = await adminClient().rpc('claim_payment_transaction', {
    p_provider: 'SPACEREMIT',
    p_transaction_id: paymentId,
    p_entity_type: 'project',
    p_entity_id: projectId,
  })
  if (claimError) {
    console.error('payment transaction claim failed:', claimError.message)
    return NextResponse.json({ error: 'PAYMENT_CLAIM_FAILED' }, { status: 500 })
  }
  if (claimed !== true) {
    return NextResponse.json({ error: 'PAYMENT_TRANSACTION_ALREADY_USED' }, { status: 409 })
  }

  // 5. Preserve the allowed initial transition, then atomically confirm payment.
  let currentStatus = String(project.status || 'DRAFT')
  if (currentStatus === 'DRAFT') {
    const { data: pendingProject, error: pendingError } = await adminClient()
      .from('projects')
      .update({ status: 'PAYMENT_PENDING' })
      .eq('id', projectId)
      .eq('payment_status', 'PAYMENT_PENDING')
      .eq('status', 'DRAFT')
      .select('id')
      .maybeSingle()
    if (pendingError) {
      console.error('project pending transition failed:', pendingError.message)
      return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
    }
    if (!pendingProject) {
      const { data: latest } = await adminClient()
        .from('projects')
        .select('status,payment_status')
        .eq('id', projectId)
        .maybeSingle()
      if (!latest || latest.status !== 'PAYMENT_PENDING' || latest.payment_status !== 'PAYMENT_PENDING') {
        return NextResponse.json({ error: 'PROJECT_STATE_CHANGED' }, { status: 409 })
      }
    }
    currentStatus = 'PAYMENT_PENDING'
  }
  if (currentStatus !== 'PAYMENT_PENDING' && currentStatus !== 'PAST_DUE') {
    return NextResponse.json({ error: 'STATUS_BLOCKED' }, { status: 409 })
  }

  const confirmedAt = new Date().toISOString()
  const { data: confirmedProject, error: confirmError } = await adminClient()
    .from('projects')
    .update({
      status: 'PAYMENT_CONFIRMED',
      payment_status: 'PAYMENT_CONFIRMED',
      payment_provider: 'SPACEREMIT',
      payment_transaction_id: paymentId,
      payment_confirmed_at: confirmedAt,
      spaceremit_payment_id: paymentId,
    })
    .eq('id', projectId)
    .eq('payment_status', 'PAYMENT_PENDING')
    .select('id')
    .maybeSingle()
  if (confirmError) {
    console.error('project payment confirmation failed:', confirmError.message)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }
  if (!confirmedProject) {
    return NextResponse.json({ error: 'ALREADY_CONFIRMED' }, { status: 409 })
  }

  // 6. Audit log (server-side only — never client-supplied).
  await adminClient().from('audit_logs').insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: 'spaceremit_payment_confirmed',
    entity: 'project',
    entity_id: projectId,
    new_value: JSON.stringify({
      payment_method: 'SPACEREMIT',
      payment_id: paymentId,
      amount_usd: tx.total_amount,
      sp_status: tx.status,
    }),
  })

  void createUserNotification({
    userId: project.user_id || user.id,
    type: 'project_payment_confirmed',
    title: 'Project payment confirmed',
    body: `Payment received for your project ($${tx.total_amount}).`,
    href: '/dashboard',
    entityType: 'project',
    entityId: projectId,
  })
  void notifyAdminEvent({
    agent: 'payment_confirmed',
    idempotencyKey: `payment:spaceremit:${projectId}:${paymentId}`,
    entityId: projectId,
    title: 'Payment confirmed (SpaceRemit)',
    lines: [
      `Project: ${projectId}`,
      `Amount: $${tx.total_amount}`,
      `Payment id: ${paymentId}`,
    ],
    adminPath: '/admin',
  })

  return NextResponse.json({ success: true })
}
