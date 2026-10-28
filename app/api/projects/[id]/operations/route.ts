import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'crypto'
import { createServiceClient } from '../../../../../lib/supabaseService'
import { revisionCharge, type ProjectOperationAction } from '../../../../../lib/projectOperations'
import { createUserNotification } from '../../../../../lib/userNotifications'
import { recordFunnelEvent } from '../../../../../lib/funnel'

async function userForRequest() {
  const jar = await cookies()
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { get: (name) => jar.get(name)?.value },
  })
  const { data: { user } } = await client.auth.getUser()
  return user
}

const db = () => createServiceClient()
const clean = (value: unknown, max: number) => String(value || '').trim().slice(0, max)

async function context(projectId: string, userId: string) {
  const { data: project } = await db().from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) return null
  const { data: profile } = await db().from('profiles').select('role').eq('id', userId).maybeSingle()
  const actor = profile?.role === 'admin' ? 'admin' : project.user_id === userId ? 'seller' : project.assigned_freelancer_id === userId ? 'freelancer' : null
  return actor ? { project, actor } : null
}

async function event(projectId: string, actorId: string, actorKind: string, eventType: string, metadata: Record<string, unknown> = {}) {
  await db().from('project_events').insert({ project_id: projectId, actor_id: actorId, actor_kind: actorKind, event_type: eventType, metadata })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await userForRequest()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  const { id } = await params
  const ctx = await context(id, user.id)
  if (!ctx) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  const client = db()
  const [assignments, messages, deliveries, revisions, disputes, events] = await Promise.all([
    client.from('project_assignments').select('*').eq('project_id', id).order('offered_at', { ascending: false }),
    client.from('project_messages').select('*').eq('project_id', id).order('created_at'),
    client.from('project_deliveries').select('*').eq('project_id', id).order('version', { ascending: false }),
    client.from('project_revision_requests').select('*').eq('project_id', id).order('request_number', { ascending: false }),
    client.from('project_disputes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    client.from('project_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(100),
  ])
  return NextResponse.json({ project: ctx.project, actor: ctx.actor, assignments: assignments.data || [], messages: messages.data || [], deliveries: deliveries.data || [], revisions: revisions.data || [], disputes: disputes.data || [], events: events.data || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await userForRequest()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  const { id } = await params
  const ctx = await context(id, user.id)
  if (!ctx) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  const body = await request.json().catch(() => null) as ProjectOperationAction | null
  if (!body?.type) return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  const client = db()

  if (body.type === 'message') {
    const text = clean(body.body, 4000)
    if (!text) return NextResponse.json({ error: 'MESSAGE_REQUIRED' }, { status: 400 })
    await client.from('project_messages').insert({ project_id: id, author_id: user.id, author_kind: ctx.actor, body: text })
    await event(id, user.id, ctx.actor, 'message_added')
  } else if (body.type === 'assign' || body.type === 'reassign') {
    if (!['seller', 'admin'].includes(ctx.actor)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const freelancerId = clean(body.freelancerId, 100)
    const { data: freelancer } = await client.from('freelancer_profiles').select('user_id').eq('user_id', freelancerId).maybeSingle()
    if (!freelancer) return NextResponse.json({ error: 'FREELANCER_NOT_FOUND' }, { status: 404 })
    await client.from('project_assignments').update({ status: 'reassigned' }).eq('project_id', id).in('status', ['offered', 'accepted'])
    const { error } = await client.from('project_assignments').insert({ project_id: id, freelancer_id: freelancerId, assigned_by: user.id })
    if (error) return NextResponse.json({ error: 'ASSIGNMENT_FAILED' }, { status: 409 })
    await client.from('projects').update({ assigned_freelancer_id: freelancerId, assignment_status: body.type === 'reassign' ? 'reassigned' : 'offered', operations_status: 'assigned', delivery_due_at: body.dueAt || null, freelancer_payout_amount: Math.max(0, Number(body.payoutAmount || ctx.project.fulfillment_cost || 0)), freelancer_payout_status: 'held' }).eq('id', id)
    await client.from('project_earnings').upsert({ project_id: id, freelancer_id: freelancerId, amount: Math.max(0, Number(body.payoutAmount || ctx.project.fulfillment_cost || 0)), status: 'held' })
    await event(id, user.id, ctx.actor, body.type === 'reassign' ? 'freelancer_reassigned' : 'freelancer_assigned', { freelancerId, dueAt: body.dueAt || null })
    await createUserNotification({ userId: freelancerId, type: 'project_assignment', title: 'New project assignment', body: `Review the assignment for ${ctx.project.title}.`, href: `/dashboard/projects/${id}`, entityType: 'project', entityId: id })
    await recordFunnelEvent('freelancer_assigned',{userId:ctx.project.user_id,projectId:id,metadata:{freelancerId}})
  } else if (body.type === 'respond_assignment') {
    if (ctx.actor !== 'freelancer') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const status = body.decision
    await client.from('project_assignments').update({ status, responded_at: new Date().toISOString(), response_note: clean(body.note, 1000) || null }).eq('project_id', id).eq('freelancer_id', user.id).eq('status', 'offered')
    await client.from('projects').update(status === 'accepted' ? { assignment_status: 'accepted', operations_status: 'in_progress' } : { assigned_freelancer_id: null, assignment_status: 'declined', operations_status: 'ready_to_assign', freelancer_payout_status: 'not_earned' }).eq('id', id)
    await event(id, user.id, 'freelancer', `assignment_${status}`)
    await createUserNotification({ userId: ctx.project.user_id, type: `assignment_${status}`, title: status === 'accepted' ? 'Freelancer accepted the project' : 'Freelancer declined the project', body: `${ctx.project.title}: the assigned freelancer ${status} the assignment.`, href: `/dashboard/projects/${id}`, entityType: 'project', entityId: id })
  } else if (body.type === 'request_revision') {
    if (!['seller', 'admin'].includes(ctx.actor)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const details = clean(body.details, 3000)
    if (!details) return NextResponse.json({ error: 'DETAILS_REQUIRED' }, { status: 400 })
    const { count } = await client.from('project_revision_requests').select('*', { count: 'exact', head: true }).eq('project_id', id)
    const requestNumber = (count || 0) + 1
    const charge = revisionCharge(requestNumber, Number(ctx.project.revision_limit || 0), Number(ctx.project.revision_price_usd || 0))
    await client.from('project_revision_requests').insert({ project_id: id, requested_by: user.id, request_number: requestNumber, details, included: charge.included, price_usd: charge.priceUsd, payment_status: charge.paymentStatus })
    await client.from('projects').update({ operations_status: 'revision_requested' }).eq('id', id)
    await event(id, user.id, ctx.actor, 'revision_requested', { requestNumber, ...charge })
    if (ctx.project.assigned_freelancer_id) await createUserNotification({ userId: ctx.project.assigned_freelancer_id, type: 'revision_requested', title: 'Project revision requested', body: details, href: `/dashboard/projects/${id}`, entityType: 'project', entityId: id })
  } else if (body.type === 'approve_delivery') {
    if (!['seller', 'admin'].includes(ctx.actor)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    if (ctx.project.operations_status !== 'delivered') return NextResponse.json({ error: 'NOT_DELIVERED' }, { status: 409 })
    if (ctx.project.payment_status !== 'PAYMENT_CONFIRMED') return NextResponse.json({ error: 'PAYMENT_NOT_CONFIRMED' }, { status: 409 })
    await client.from('projects').update({ operations_status: 'approved', freelancer_payout_status: 'releasable' }).eq('id', id)
    await client.from('project_earnings').update({ status: 'releasable' }).eq('project_id', id).eq('status', 'held')
    await event(id, user.id, ctx.actor, 'delivery_approved')
    await recordFunnelEvent('approved',{userId:ctx.project.user_id,projectId:id,amountUsd:Number(ctx.project.client_price||0)})
    if (ctx.project.assigned_freelancer_id) {
      await createUserNotification({ userId: ctx.project.assigned_freelancer_id, type: 'delivery_approved', title: 'Your delivery was approved', body: `The delivery for ${ctx.project.title} was approved. Your payout is now eligible for release.`, href: `/dashboard/projects/${id}`, entityType: 'project', entityId: id })
      await client.rpc('refresh_freelancer_metrics',{p_user_id:ctx.project.assigned_freelancer_id})
    }
  } else if (body.type === 'open_dispute') {
    const reason = clean(body.reason, 3000)
    if (reason.length < 10) return NextResponse.json({ error: 'REASON_TOO_SHORT' }, { status: 400 })
    await client.from('project_disputes').insert({ project_id: id, opened_by: user.id, reason })
    await client.from('projects').update({ operations_status: 'disputed' }).eq('id', id)
    await event(id, user.id, ctx.actor, 'dispute_opened')
  } else if (body.type === 'create_client_portal') {
    if (!['seller', 'admin'].includes(ctx.actor)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await client.from('project_client_tokens').upsert({ project_id: id, token_hash: tokenHash, created_by: user.id, revoked_at: null })
    await event(id, user.id, ctx.actor, 'client_portal_created')
    return NextResponse.json({ ok: true, portalPath: `/client/project/${token}` })
  } else if (body.type === 'create_revision_invoice') {
    if (!['seller', 'admin'].includes(ctx.actor)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const { data: revision } = await client.from('project_revision_requests').select('*').eq('id', clean(body.revisionId, 100)).eq('project_id', id).maybeSingle()
    if (!revision || revision.included || Number(revision.price_usd) <= 0) return NextResponse.json({ error: 'REVISION_NOT_BILLABLE' }, { status: 409 })
    const { data: existing } = await client.from('invoices').select('id').eq('revision_request_id', revision.id).maybeSingle()
    if (existing) return NextResponse.json({ ok: true, invoicePath: `/invoice/${existing.id}` })
    const { data: invoice, error } = await client.from('invoices').insert({ project_id: id, user_id: ctx.project.user_id, invoice_number: `REV-${String(revision.request_number).padStart(3,'0')}-${id.slice(0,6).toUpperCase()}`, client_name: ctx.project.client_contact_email || null, client_email: ctx.project.client_contact_email || null, currency: 'USD', amount: revision.price_usd, status: 'PENDING', kind: 'revision', revision_request_id: revision.id }).select('id').single()
    if (error || !invoice) return NextResponse.json({ error: 'INVOICE_CREATE_FAILED' }, { status: 500 })
    await event(id, user.id, ctx.actor, 'revision_invoice_created', { revisionId: revision.id, invoiceId: invoice.id })
    return NextResponse.json({ ok: true, invoicePath: `/invoice/${invoice.id}` })
  } else {
    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
