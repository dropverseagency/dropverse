import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { processEmailQueue } from '@/lib/ops/email'
import { sendAdminAlert } from '@/lib/ops/telegram'
import { transitionOrder } from '@/lib/orderEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('[cron] CRON_SECRET missing — rejecting')
    return false
  }
  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  if (request.nextUrl.searchParams.get('secret') === secret) return true
  return false
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const summary: Record<string, number | string> = { ok: 1 }

  const email = await processEmailQueue(40)
  summary.email_processed = email.processed
  summary.email_sent = email.sent

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: stale } = await supabase
      .from('projects')
      .select('id')
      .eq('status', 'PAYMENT_PENDING')
      .lt('created_at', cutoff)
      .limit(50)
    let cancelled = 0
    for (const row of stale || []) {
      const r = await transitionOrder({
        projectId: row.id,
        to: 'cancelled',
        actorType: 'cron',
        reason: 'abandoned_pending_payment_7d',
        idempotencyKey: `cron:cancel:${row.id}`,
      })
      if (r.ok && !('noop' in r && r.noop)) cancelled += 1
      else if (r.ok) cancelled += 0
    }
    summary.cancelled_stale = cancelled
  } catch (e) {
    summary.stale_error = e instanceof Error ? e.message : 'error'
  }

  try {
    const stuckSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: stuck } = await supabase
      .from('projects')
      .select('id, status')
      .in('status', ['PAYMENT_CONFIRMED', 'IN_PROGRESS', 'READY_FOR_FULFILLMENT', 'ACTIVE'])
      .or(`last_activity_at.is.null,last_activity_at.lt.${stuckSince}`)
      .limit(20)
    summary.stuck_count = stuck?.length ?? 0
    if (stuck && stuck.length > 0) {
      await sendAdminAlert({
        key: `stuck:${new Date().toISOString().slice(0, 10)}`,
        text: `DropVerse: ${stuck.length} order(s) with no activity >48h. Check admin exceptions.`,
        dedupeSeconds: 20 * 60 * 60,
      })
    }
  } catch (e) {
    summary.stuck_error = e instanceof Error ? e.message : 'error'
  }

  try {
    const deliveredCutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const { data: delivered } = await supabase
      .from('projects')
      .select('id')
      .in('status', ['DELIVERED', 'IN_REVIEW'])
      .lt('delivered_at', deliveredCutoff)
      .limit(40)
    let completed = 0
    for (const row of delivered || []) {
      const r = await transitionOrder({
        projectId: row.id,
        to: 'completed',
        actorType: 'cron',
        reason: 'auto_complete_5d_after_delivery',
        idempotencyKey: `cron:complete:${row.id}`,
      })
      if (r.ok && !(r as { noop?: boolean }).noop) completed += 1
    }
    summary.auto_completed = completed
  } catch (e) {
    summary.complete_error = e instanceof Error ? e.message : 'error'
  }

  try {
    await supabase.rpc('cleanup_rate_limit_buckets', { max_age: '2 hours' })
    summary.rl_cleanup = 1
  } catch {
    summary.rl_cleanup = 0
  }

  try {
    const { data: mismatches } = await supabase
      .from('projects')
      .select('id')
      .eq('payment_status', 'PAYMENT_PENDING')
      .not('spaceremit_payment_id', 'is', null)
      .limit(20)
    summary.reconcile_candidates = mismatches?.length ?? 0
    if (mismatches && mismatches.length > 0) {
      await sendAdminAlert({
        key: `reconcile:${new Date().toISOString().slice(0, 10)}`,
        text: `DropVerse: ${mismatches.length} pending payment(s) have a SpaceRemit id — review admin exceptions.`,
        dedupeSeconds: 20 * 60 * 60,
      })
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({ status: 'ok', summary, time: new Date().toISOString() })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
