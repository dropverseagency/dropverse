import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit, requireAdmin, AdminOnlyError } from '@/lib/adminCore'

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
      .select('id, title, owner_id, status, price_usd')
      .eq('id', id)
      .single()
    if (loadError || !sample) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const patch: Record<string, unknown> = {
      reviewed_by: adminUser.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: action === 'reject' ? rejectionReason : null,
      status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'unpublished',
    }
    if (action === 'approve' && sample.price_usd == null) {
      return NextResponse.json({ error: 'PRICE_REQUIRED_BEFORE_APPROVAL' }, { status: 400 })
    }
    const { data: updated, error: updateError } = await admin
      .from('samples')
      .update(patch)
      .eq('id', id)
      .select('id, title, status, rejection_reason, reviewed_at')
      .single()
    if (updateError || !updated) throw new Error('UPDATE_FAILED')

    await audit({
      actorId: adminUser.userId,
      actorEmail: adminUser.email,
      action: `sample_${action}`,
      entity: 'sample',
      entityId: id,
      oldValue: { status: sample.status },
      newValue: updated,
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
