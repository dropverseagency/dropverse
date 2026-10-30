import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit, requireAdmin, reportAdminError } from '@/lib/adminCore'
import { notifyAdminEvent } from '@/lib/agents/adminNotify'
import { createUserNotification } from '@/lib/userNotifications'

export const runtime = 'nodejs'

/**
 * POST /api/admin/leads/[id]/moderate
 * Body: { action: 'approve' | 'reject' | 'suspend', rejectReason?, adminMaxBuyers? }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireAdmin()
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').trim()
    const rejectReason = String(body?.rejectReason || '').trim()

    if (!['approve', 'reject', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
    }
    if ((action === 'reject' || action === 'suspend') && rejectReason.length < 3) {
      return NextResponse.json({ error: 'REJECT_REASON_REQUIRED' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: pack, error: loadError } = await admin.from('lead_packs').select('*').eq('id', id).single()
    if (loadError || !pack) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const patch: Record<string, unknown> = {
      reviewed_by: adminUser.userId,
      reviewed_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      patch.status = 'approved'
      patch.reject_reason = null
      if (body?.adminMaxBuyers !== undefined && body?.adminMaxBuyers !== null && String(body.adminMaxBuyers).trim() !== '') {
        const n = Number(body.adminMaxBuyers)
        if (!Number.isFinite(n) || n < 1 || n > 100000) {
          return NextResponse.json({ error: 'INVALID_ADMIN_MAX_BUYERS' }, { status: 400 })
        }
        patch.admin_max_buyers = Math.floor(n)
      }
    } else if (action === 'reject') {
      patch.status = 'rejected'
      patch.reject_reason = rejectReason
    } else {
      patch.status = 'suspended'
      patch.reject_reason = rejectReason
    }

    const { data: updated, error: updateError } = await admin
      .from('lead_packs')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (updateError || !updated) {
      console.error('[admin leads moderate]', updateError)
      return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
    }

    await audit({
      actorId: adminUser.userId,
      actorEmail: adminUser.email,
      action: `lead_pack_${action}`,
      entity: 'lead_pack',
      entityId: id,
      oldValue: { status: pack.status },
      newValue: { status: updated.status, reject_reason: updated.reject_reason },
    })

    if (pack.seller_id) {
      void createUserNotification({
        userId: String(pack.seller_id),
        type: `lead_pack_${action}`,
        title:
          action === 'approve'
            ? 'Your lead pack was approved'
            : action === 'reject' || action === 'request_changes'
              ? 'Your lead pack was rejected'
              : 'Your lead pack was suspended',
        body: updated.reject_reason ? String(updated.reject_reason) : `Status is now ${updated.status}.`,
        href: '/dashboard/leads',
        entityType: 'lead_pack',
        entityId: id,
      })
    }
    void notifyAdminEvent({
      agent: 'lead_pack_moderation',
      idempotencyKey: `lead_pack_${action}:${id}:${updated.reviewed_at || updated.status}`,
      entityId: id,
      title: `Lead pack ${action}`,
      lines: [
        `Title: ${updated.title || pack.title || id}`,
        `Status: ${updated.status}`,
        updated.reject_reason ? `Reason: ${updated.reject_reason}` : null,
      ].filter(Boolean) as string[],
      adminPath: '/admin/leads',
    })

    return NextResponse.json({ ok: true, pack: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ERROR'
    if (msg === 'NOT_AUTHENTICATED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'FORBIDDEN' || msg === 'NOT_ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    console.error('[admin leads moderate]', e)
    await reportAdminError(e, '/api/admin/leads/[id]/moderate', 'POST')
    return NextResponse.json({ error: 'MODERATE_FAILED' }, { status: 500 })
  }
}
