import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../../lib/supabaseService'
import { createUserNotification } from '../../../../../lib/userNotifications'
import { recordFunnelEvent } from '../../../../../lib/funnel'

async function currentUser() {
  const jar = await cookies()
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get: (name) => jar.get(name)?.value } })
  return (await client.auth.getUser()).data.user
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  const { id } = await params
  const admin = createServiceClient()
  const { data: project } = await admin.from('projects').select('id,user_id,title,assigned_freelancer_id,operations_status').eq('id', id).maybeSingle()
  if (!project) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (project.assigned_freelancer_id !== user.id && profile?.role !== 'admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!['in_progress','revision_requested','delivered'].includes(project.operations_status)) return NextResponse.json({ error: 'DELIVERY_NOT_ALLOWED' }, { status: 409 })
  const form = await request.formData()
  const file = form.get('file')
  const note = String(form.get('note') || '').trim().slice(0, 2000)
  if (!(file instanceof File) || !file.size || file.size > 100 * 1024 * 1024) return NextResponse.json({ error: 'INVALID_FILE' }, { status: 400 })
  const { count } = await admin.from('project_deliveries').select('*', { count: 'exact', head: true }).eq('project_id', id)
  const version = (count || 0) + 1
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'delivery'
  const path = `${id}/v${version}/${crypto.randomUUID()}-${safeName}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage.from('project-deliveries').upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (uploadError) return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
  const { data: row, error } = await admin.from('project_deliveries').insert({ project_id: id, version, submitted_by: user.id, storage_path: path, file_name: safeName, mime_type: file.type || null, size_bytes: file.size, note: note || null }).select('id').single()
  if (error) { await admin.storage.from('project-deliveries').remove([path]); return NextResponse.json({ error: 'DELIVERY_SAVE_FAILED' }, { status: 500 }) }
  await admin.from('projects').update({ operations_status: 'delivered' }).eq('id', id)
  await admin.from('project_revision_requests').update({ status: 'delivered' }).eq('project_id', id).in('status', ['open','in_progress'])
  await admin.from('project_events').insert({ project_id: id, actor_id: user.id, actor_kind: profile?.role === 'admin' ? 'admin' : 'freelancer', event_type: 'delivery_submitted', metadata: { deliveryId: row.id, version, fileName: safeName } })
  void createUserNotification({ userId: project.user_id, type: 'project_delivered', title: 'Project delivery ready', body: `${project.title} has a new delivery to review.`, href: `/dashboard/projects/${id}`, entityType: 'project', entityId: id })
  await recordFunnelEvent('delivered',{userId:project.user_id,projectId:id,metadata:{version}})
  return NextResponse.json({ ok: true, deliveryId: row.id, version })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  const { id } = await params
  const deliveryId = new URL(request.url).searchParams.get('deliveryId') || ''
  const admin = createServiceClient()
  const { data: project } = await admin.from('projects').select('user_id,assigned_freelancer_id').eq('id', id).maybeSingle()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!project || (project.user_id !== user.id && project.assigned_freelancer_id !== user.id && profile?.role !== 'admin')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { data: delivery } = await admin.from('project_deliveries').select('storage_path').eq('id', deliveryId).eq('project_id', id).maybeSingle()
  if (!delivery) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const { data } = await admin.storage.from('project-deliveries').createSignedUrl(delivery.storage_path, 300)
  return data?.signedUrl ? NextResponse.json({ url: data.signedUrl }) : NextResponse.json({ error: 'SIGN_FAILED' }, { status: 500 })
}
