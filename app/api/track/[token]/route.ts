import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { dbStatusToLifecycle } from '@/lib/orderEngine'

export const runtime = 'nodejs'

/** Public order tracking by unguessable token — no internal costs. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const clean = String(token || '').trim()
  if (!clean || clean.length < 16) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, status, payment_status, created_at, last_activity_at, delivered_at, title, brief_title')
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

  return NextResponse.json({
    status: project.status,
    lifecycle: dbStatusToLifecycle(project.status),
    paymentStatus: project.payment_status,
    title: project.title || project.brief_title || 'Order',
    createdAt: project.created_at,
    lastUpdate: project.last_activity_at || project.created_at,
    deliveredAt: project.delivered_at,
    events: events.map((e) => ({
      status: e.to_status,
      at: e.created_at,
      note: e.reason,
    })),
  })
}
