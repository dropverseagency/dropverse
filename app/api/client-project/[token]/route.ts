import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseService'
import { clientIp, rateLimit, rateLimitResponse } from '../../../../lib/rateLimit'
import { revisionCharge } from '../../../../lib/projectOperations'
import { createUserNotification } from '../../../../lib/userNotifications'
import { recordFunnelEvent } from '../../../../lib/funnel'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
async function portal(token: string) {
  const admin = createServiceClient()
  const { data } = await admin.from('project_client_tokens').select('project_id,expires_at,revoked_at').eq('token_hash', hash(token)).maybeSingle()
  if (!data || data.revoked_at || (data.expires_at && new Date(data.expires_at) <= new Date())) return null
  await admin.from('project_client_tokens').update({ last_used_at: new Date().toISOString() }).eq('project_id', data.project_id)
  return { admin, projectId: data.project_id }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const access = await portal((await params).token)
  if (!access) return NextResponse.json({ error: 'PORTAL_NOT_FOUND' }, { status: 404 })
  const deliveryId = new URL(request.url).searchParams.get('deliveryId')
  if (deliveryId) {
    const { data } = await access.admin.from('project_deliveries').select('storage_path').eq('id', deliveryId).eq('project_id', access.projectId).maybeSingle()
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    const signed = await access.admin.storage.from('project-deliveries').createSignedUrl(data.storage_path, 300)
    return signed.data?.signedUrl ? NextResponse.json({ url: signed.data.signedUrl }) : NextResponse.json({ error: 'SIGN_FAILED' }, { status: 500 })
  }
  const [project, messages, deliveries, revisions, invoices] = await Promise.all([
    access.admin.from('projects').select('id,title,description,delivery_due_at,operations_status,payment_status,revision_limit,revision_price_usd,user_id,organization_id,assigned_freelancer_id').eq('id', access.projectId).single(),
    access.admin.from('project_messages').select('id,author_kind,body,created_at').eq('project_id', access.projectId).order('created_at'),
    access.admin.from('project_deliveries').select('id,version,file_name,note,created_at').eq('project_id', access.projectId).order('version', { ascending: false }),
    access.admin.from('project_revision_requests').select('id,request_number,details,included,price_usd,payment_status,status,created_at').eq('project_id', access.projectId).order('request_number', { ascending: false }),
    access.admin.from('invoices').select('id,invoice_number,status,amount,currency,kind,created_at').eq('project_id', access.projectId).order('created_at'),
  ])
  if (!project.data) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  let brand=null
  if(project.data.organization_id){const {data:page}=await access.admin.from('agency_landing_pages').select('display_name,logo_url,primary_color,invoice_footer').eq('organization_id',project.data.organization_id).eq('published',true).maybeSingle();brand=page}
  return NextResponse.json({ project: { ...project.data, user_id: undefined, assigned_freelancer_id:undefined }, brand, invoices:invoices.data||[], messages: messages.data || [], deliveries: deliveries.data || [], revisions: revisions.data || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limit = await rateLimit(`client-project:${clientIp(request)}`, { limit: 20, windowMs: 60_000 })
  if (!limit.success) return rateLimitResponse(limit)
  const access = await portal((await params).token)
  if (!access) return NextResponse.json({ error: 'PORTAL_NOT_FOUND' }, { status: 404 })
  const body = await request.json().catch(() => ({})) as { action?: string; text?: string; rating?:number }
  const text = String(body.text || '').trim()
  const { data: project } = await access.admin.from('projects').select('*').eq('id', access.projectId).single()
  if (!project) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  if (body.action === 'message') {
    if (!text || text.length > 4000) return NextResponse.json({ error: 'INVALID_MESSAGE' }, { status: 400 })
    await access.admin.from('project_messages').insert({ project_id: access.projectId, author_kind: 'client', body: text })
    await access.admin.from('project_events').insert({ project_id: access.projectId, actor_kind: 'client', event_type: 'client_message_added' })
  } else if (body.action === 'revision') {
    if (text.length < 3 || text.length > 3000 || project.operations_status !== 'delivered') return NextResponse.json({ error: 'REVISION_NOT_ALLOWED' }, { status: 409 })
    const { count } = await access.admin.from('project_revision_requests').select('*', { count: 'exact', head: true }).eq('project_id', access.projectId)
    const requestNumber = (count || 0) + 1
    const charge = revisionCharge(requestNumber, Number(project.revision_limit || 0), Number(project.revision_price_usd || 0))
    await access.admin.from('project_revision_requests').insert({ project_id: access.projectId, request_number: requestNumber, details: text, included: charge.included, price_usd: charge.priceUsd, payment_status: charge.paymentStatus })
    await access.admin.from('projects').update({ operations_status: 'revision_requested' }).eq('id', access.projectId)
    await access.admin.from('project_events').insert({ project_id: access.projectId, actor_kind: 'client', event_type: 'revision_requested', metadata: { requestNumber, ...charge } })
    if (project.assigned_freelancer_id) void createUserNotification({ userId: project.assigned_freelancer_id, type: 'revision_requested', title: 'Client requested a revision', body: text, href: `/dashboard/projects/${access.projectId}`, entityType: 'project', entityId: access.projectId })
  } else if (body.action === 'approve') {
    if (project.operations_status !== 'delivered') return NextResponse.json({ error: 'NOT_DELIVERED' }, { status: 409 })
    if (project.payment_status !== 'PAYMENT_CONFIRMED') return NextResponse.json({ error: 'PAYMENT_NOT_CONFIRMED' }, { status: 409 })
    await access.admin.from('projects').update({ operations_status: 'approved', freelancer_payout_status: 'releasable' }).eq('id', access.projectId)
    await access.admin.from('project_earnings').update({ status: 'releasable' }).eq('project_id', access.projectId).eq('status', 'held')
    await access.admin.from('project_events').insert({ project_id: access.projectId, actor_kind: 'client', event_type: 'delivery_approved' })
    await recordFunnelEvent('approved',{projectId:access.projectId,amountUsd:Number(project.client_price||0),metadata:{actor:'client'}})
    if(project.assigned_freelancer_id)await access.admin.rpc('refresh_freelancer_metrics',{p_user_id:project.assigned_freelancer_id})
  } else if(body.action==='review'){
    const rating=Math.floor(Number(body.rating));if(project.operations_status!=='approved'||project.payment_status!=='PAYMENT_CONFIRMED'||!project.assigned_freelancer_id||rating<1||rating>5)return NextResponse.json({error:'REVIEW_NOT_ALLOWED'},{status:409})
    const {error}=await access.admin.from('project_reviews').insert({project_id:access.projectId,freelancer_id:project.assigned_freelancer_id,reviewer_kind:'client',rating,comment:text.slice(0,2000)})
    if(error)return NextResponse.json({error:'REVIEW_ALREADY_SUBMITTED'},{status:409})
    await access.admin.rpc('refresh_freelancer_metrics',{p_user_id:project.assigned_freelancer_id})
  } else return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  void createUserNotification({ userId: project.user_id, type: `client_${body.action}`, title: `Client ${body.action}`, body: text || `Client ${body.action} recorded.`, href: `/dashboard/projects/${access.projectId}`, entityType: 'project', entityId: access.projectId })
  return NextResponse.json({ ok: true })
}
