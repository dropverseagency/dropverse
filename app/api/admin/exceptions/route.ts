import { NextResponse } from 'next/server'
import { AdminOnlyError, requireAdmin } from '@/lib/adminCore'
import { createServiceClient } from '@/lib/supabaseService'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminOnlyError) {
      return NextResponse.json({ error: e.message }, { status: e.message === 'NOT_AUTHENTICATED' ? 401 : 403 })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const admin = createServiceClient()
  const exceptions: Array<{ kind: string; id: string; label: string; detail?: string }> = []

  try {
    const stuckSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: stuck } = await admin
      .from('projects')
      .select('id, status, title, brief_title')
      .in('status', ['PAYMENT_CONFIRMED', 'IN_PROGRESS', 'READY_FOR_FULFILLMENT', 'ACTIVE', 'DELIVERED', 'IN_REVIEW'])
      .or(`last_activity_at.is.null,last_activity_at.lt.${stuckSince}`)
      .limit(30)
    for (const row of stuck || []) {
      exceptions.push({
        kind: 'stuck_order',
        id: row.id,
        label: row.title || row.brief_title || row.id,
        detail: `status=${row.status}`,
      })
    }
  } catch { /* ignore */ }

  try {
    const { data: failed } = await admin
      .from('email_queue')
      .select('id, to_email, template, last_error, attempts')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(20)
    for (const row of failed || []) {
      exceptions.push({
        kind: 'failed_email',
        id: row.id,
        label: `${row.template} → ${row.to_email}`,
        detail: row.last_error || `attempts=${row.attempts}`,
      })
    }
  } catch { /* table may be missing */ }

  try {
    const { data: pending } = await admin
      .from('projects')
      .select('id, title, brief_title')
      .eq('payment_status', 'PAYMENT_PENDING')
      .not('spaceremit_payment_id', 'is', null)
      .limit(20)
    for (const row of pending || []) {
      exceptions.push({
        kind: 'reconcile',
        id: row.id,
        label: row.title || row.brief_title || row.id,
        detail: 'pending with SpaceRemit id',
      })
    }
  } catch { /* ignore */ }

  return NextResponse.json({ exceptions })
}
