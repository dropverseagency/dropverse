'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { adminClient } from '@/lib/adminCore'
import { cookies } from 'next/headers'

import {
  STATUS_TRANSITIONS,
  type ProjectStatus,
} from '../../../../lib/projectConfig'
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

  // 3. Cross-check amount & currency against the project's fulfillment cost.
  const expected = Number(project.fulfillment_cost || 0)
  const paid = Number(tx.total_amount || 0)
  if (tx.currency !== 'USD' || !(Math.abs(paid - expected) < 0.01)) {
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

  // 4. Advance the project through allowed status transitions:
  //    DRAFT -> PAYMENT_PENDING -> PAYMENT_CONFIRMED
  let currentStatus: ProjectStatus = (project.status || 'DRAFT') as ProjectStatus
  const path: ProjectStatus[] = [
    currentStatus,
    'PAYMENT_PENDING',
    'PAYMENT_CONFIRMED',
  ]
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]
    const to = path[i + 1]
    if (from === to) continue
    if (!STATUS_TRANSITIONS[from].includes(to)) {
      return NextResponse.json({ error: 'STATUS_BLOCKED' }, { status: 409 })
    }
    await adminClient()
      .from('projects')
      .update({ status: to, payment_status: to })
      .eq('id', projectId)
    currentStatus = to
  }
  await adminClient()
    .from('projects')
    .update({
      payment_status: 'PAYMENT_CONFIRMED',
      spaceremit_payment_id: paymentId,
    })
    .eq('id', projectId)

  // 5. Audit log (server-side only — never client-supplied).
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
