'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { rateLimitResponse, clientIp, rateLimit } from '@/lib/rateLimit'
import { runAfterPaymentConfirmed } from '@/lib/ops/sideEffects'
import {
  STATUS_TRANSITIONS,
  type ProjectStatus,
} from '../../../../lib/projectConfig'

/**
 * Confirms a SpaceRemit payment and promotes the project status —
 * server-side ONLY. Side effects never block or change the payment result.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetch as unknown as typeof globalThis.fetch } },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  const _rl = await rateLimit(`spaceremit-verify:${user.id}:${clientIp(request)}`, { limit: 10, windowMs: 60_000 })
  if (!_rl.success) return rateLimitResponse(_rl)

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

  const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
  if (!privateKey || privateKey.startsWith('PLACEHOLDER')) {
    return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
  }

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

  const expected = Number(project.fulfillment_cost || 0)
  const paid = Number(tx.total_amount || 0)
  if (tx.currency !== 'USD' || !(Math.abs(paid - expected) < 0.01)) {
    return NextResponse.json({ error: 'SP_AMOUNT_MISMATCH' }, { status: 422 })
  }

  let currentStatus: ProjectStatus = (project.status || 'DRAFT') as ProjectStatus
  const path: ProjectStatus[] = [currentStatus, 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED']
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]
    const to = path[i + 1]
    if (from === to) continue
    if (!STATUS_TRANSITIONS[from].includes(to)) {
      return NextResponse.json({ error: 'STATUS_BLOCKED' }, { status: 409 })
    }
    await supabase.from('projects').update({ status: to, payment_status: to }).eq('id', projectId)
    currentStatus = to
  }
  await supabase
    .from('projects')
    .update({ payment_status: 'PAYMENT_CONFIRMED', spaceremit_payment_id: paymentId })
    .eq('id', projectId)

  await supabase.from('audit_logs').insert({
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

  // Side effects MUST NOT block or alter payment result
  void (async () => {
    try {
      await runAfterPaymentConfirmed({
        projectId,
        paymentId,
        actorId: user.id,
        actorType: 'user',
        customerEmail: user.email,
        source: 'spaceremit_verify',
      })
    } catch (e) {
      console.warn('[verify] sideEffects', e instanceof Error ? e.message : 'error')
    }
  })()

  return NextResponse.json({ success: true })
}
