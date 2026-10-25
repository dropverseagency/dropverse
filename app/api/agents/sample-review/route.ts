import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runSampleReviewAgent } from '@/lib/agents/sampleReviewAgent'

export const runtime = 'nodejs'

function agentsEnabled(): boolean {
  return process.env.AGENTS_ENABLED === 'true'
}

function verifyWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.AGENTS_WEBHOOK_SECRET || ''
  if (!expected || !headerValue) return false
  const a = Buffer.from(headerValue)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Supabase Database Webhook (or manual) entry for Agent A.
 * Only notifies + pre-checks. Never mutates sample status.
 */
export async function POST(request: NextRequest) {
  if (!agentsEnabled()) {
    return NextResponse.json({ ok: true, skipped: 'AGENTS_DISABLED' })
  }

  const secret = request.headers.get('x-webhook-secret')
  if (!verifyWebhookSecret(secret)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const record = body?.record || body?.new || body
  const oldRecord = body?.old_record || body?.old || null
  const sampleId = String(record?.id || body?.sample_id || '').trim()
  if (!sampleId) {
    return NextResponse.json({ error: 'SAMPLE_ID_REQUIRED' }, { status: 400 })
  }

  const newStatus = record?.status
  const oldStatus = oldRecord?.status
  if (newStatus && newStatus !== 'pending_review') {
    return NextResponse.json({ ok: true, skipped: 'NOT_PENDING_REVIEW' })
  }
  if (oldStatus === 'pending_review' && newStatus === 'pending_review') {
    return NextResponse.json({ ok: true, skipped: 'NO_TRANSITION' })
  }

  try {
    const result = await runSampleReviewAgent({
      sampleId,
      updatedAt: record?.updated_at ?? null,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[agents/sample-review]', e)
    return NextResponse.json({ ok: true, processed: false, skipped: 'INTERNAL_ERROR' })
  }
}
