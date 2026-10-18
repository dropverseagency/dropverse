import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { dbStatusToLifecycle, transitionOrder } from '@/lib/orderEngine'
import { runAfterLifecycleEmail } from '@/lib/ops/sideEffects'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/** Public order tracking — never exposes costs, pay, or other orders. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const rl = await rateLimit(`track:${clientIp(request)}`, { limit: 30, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  const { token } = await context.params
  const clean = String(token || '').trim()
  if (!clean || clean.length < 16) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select(
      'id, status, payment_status, created_at, last_activity_at, delivered_at, title, brief_title, revision_count, revision_limit, client_contact_email',
    )
    .eq('tracking_token', clean)
    .maybeSingle()

  if (error || !project) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  let events: Array<{ to_status: string; created_at: string; reason: string | null }> = []
  try {
    const { data } = await supabase
      .from('order_events')
      .select('to_status, created_at, reason')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true })
      .limit(40)
    events = data || []
  } catch {
    /* migration not applied */
  }

  const lifecycle = dbStatusToLifecycle(project.status)
  const revCount = Number(project.revision_count || 0)
  const revLimit = Number(project.revision_limit ?? 2)

  return NextResponse.json({
    status: project.status,
    lifecycle,
    paymentStatus: project.payment_status,
    title: project.title || project.brief_title || 'Order',
    createdAt: project.created_at,
    lastUpdate: project.last_activity_at || project.created_at,
    deliveredAt: project.delivered_at,
    revisionsUsed: revCount,
    revisionsLimit: revLimit,
    canRequestRevision: lifecycle === 'delivered' && revCount < revLimit,
    canApprove: lifecycle === 'delivered',
    canMarkDelivered: lifecycle === 'in_progress' || lifecycle === 'confirmed' || lifecycle === 'revision_requested',
    events: events.map((e) => ({
      status: e.to_status,
      at: e.created_at,
      note: e.reason,
    })),
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const rl = await rateLimit(`track-action:${clientIp(request)}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  const { token } = await context.params
  const clean = String(token || '').trim()
  if (!clean || clean.length < 16) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '').trim()

  const supabase = createServiceClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, status, revision_count, revision_limit, client_contact_email')
    .eq('tracking_token', clean)
    .maybeSingle()

  if (error || !project) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  if (action === 'mark_delivered') {
    const r = await transitionOrder({
      projectId: project.id,
      to: 'delivered',
      actorType: 'seller',
      reason: 'seller_mark_delivered',
      idempotencyKey: `delivered:${project.id}:${project.status}`,
    })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
    void runAfterLifecycleEmail({
      projectId: project.id,
      to: 'delivered',
      customerEmail: project.client_contact_email,
    })
    return NextResponse.json({ ok: true, lifecycle: 'delivered' })
  }

  if (action === 'approve') {
    const r = await transitionOrder({
      projectId: project.id,
      to: 'completed',
      actorType: 'buyer',
      reason: 'buyer_approve',
      idempotencyKey: `complete:${project.id}`,
    })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
    void runAfterLifecycleEmail({
      projectId: project.id,
      to: 'completed',
      customerEmail: project.client_contact_email,
    })
    return NextResponse.json({ ok: true, lifecycle: 'completed' })
  }

  if (action === 'request_revision') {
    const revCount = Number(project.revision_count || 0)
    const revLimit = Number(project.revision_limit ?? 2)
    if (revCount >= revLimit) {
      return NextResponse.json({ error: 'REVISION_LIMIT' }, { status: 409 })
    }
    const r = await transitionOrder({
      projectId: project.id,
      to: 'revision_requested',
      actorType: 'buyer',
      reason: 'buyer_revision',
      metadata: { revision: revCount + 1 },
      idempotencyKey: `revision:${project.id}:${revCount + 1}`,
    })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
    // revision_count is incremented inside transitionOrder
    void runAfterLifecycleEmail({
      projectId: project.id,
      to: 'revision_requested',
      customerEmail: project.client_contact_email,
    })
    return NextResponse.json({
      ok: true,
      lifecycle: 'revision_requested',
      revisionsUsed: revCount + 1,
    })
  }

  return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
}
