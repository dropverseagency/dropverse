import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit, requireAdmin, AdminOnlyError } from '@/lib/adminCore'
import { notifyAdminEvent } from '@/lib/agents/adminNotify'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin()
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').trim()
    const rejectionReason = String(body?.rejectionReason || '').trim()
    if (!['approve', 'reject', 'unpublish'].includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
    }
    if (action === 'reject' && (rejectionReason.length < 3 || rejectionReason.length > 500)) {
      return NextResponse.json({ error: 'REJECTION_REASON_REQUIRED' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: sample, error: loadError } = await admin
      .from('samples')
      .select('id, title, owner_id, status, price_usd, commission_rate')
      .eq('id', id)
      .single()
    if (loadError || !sample) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const patch: Record<string, unknown> = {
      reviewed_by: adminUser.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: action === 'reject' ? rejectionReason : null,
      status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'unpublished',
    }
    let priceUsd: number | null = sample.price_usd == null ? null : Number(sample.price_usd)
    let commissionRate: number | null = sample.commission_rate == null ? null : Number(sample.commission_rate)

    if (action === 'approve' && body?.priceUsd !== undefined && body?.priceUsd !== null && String(body.priceUsd).trim() !== '') {
      priceUsd = Number(body.priceUsd)
      if (!Number.isFinite(priceUsd) || priceUsd <= 0 || priceUsd > 1000000) {
        return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 })
      }
    }
    if (action === 'approve' && body?.commissionRate !== undefined && body?.commissionRate !== null && String(body.commissionRate).trim() !== '') {
      commissionRate = Number(body.commissionRate)
      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        return NextResponse.json({ error: 'INVALID_COMMISSION_RATE' }, { status: 400 })
      }
    }
    if (action === 'approve' && priceUsd === null) {
      return NextResponse.json({ error: 'PRICE_REQUIRED_BEFORE_APPROVAL' }, { status: 400 })
    }
    if (action === 'approve' && (commissionRate === null || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)) {
      return NextResponse.json({ error: 'COMMISSION_REQUIRED_BEFORE_APPROVAL' }, { status: 400 })
    }
    if (action === 'approve') {
      patch.price_usd = Math.round(priceUsd! * 100) / 100
      patch.commission_rate = Math.round(commissionRate! * 100) / 100
    }

    const { data: updated, error: updateError } = await admin
      .from('samples')
      .update(patch)
      .eq('id', id)
      .select('id, title, status, price_usd, commission_rate, rejection_reason, reviewed_at')
      .single()
    if (updateError || !updated) throw new Error('UPDATE_FAILED')

    await audit({
      actorId: adminUser.userId,
      actorEmail: adminUser.email,
      action: `sample_${action}`,
      entity: 'sample',
      entityId: id,
      oldValue: { status: sample.status, price_usd: sample.price_usd, commission_rate: sample.commission_rate },
      newValue: updated,
    })
    void notifyAdminEvent({
      agent: 'sample_moderation',
      idempotencyKey: `sample_${action}:${id}:${updated.reviewed_at || updated.status}`,
      entityId: id,
      title: `Sample ${action}`,
      lines: [
        `Title: ${updated.title || sample.title}`,
        `Status: ${updated.status}`,
        action === 'reject' ? `Reason: ${updated.rejection_reason || '—'}` : `Price: ${updated.price_usd ?? '—'}`,
      ],
      adminPath: '/admin/samples',
    })
    return NextResponse.json({ ok: true, sample: updated })
  } catch (e) {
    if (e instanceof AdminOnlyError) {
      return NextResponse.json({ error: e.code }, { status: e.code === 'NOT_AUTHENTICATED' ? 401 : 403 })
    }
    console.error('[admin samples moderate]', e)
    return NextResponse.json({ error: 'MODERATE_FAILED' }, { status: 500 })
  }
}
