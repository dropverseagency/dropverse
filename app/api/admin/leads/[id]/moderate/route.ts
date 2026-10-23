import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit, requireAdmin } from '@/lib/adminCore'

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
    const adminMaxBuyers =
      body?.adminMaxBuyers === null || body?.adminMaxBuyers === undefined || body?.adminMaxBuyers === ''
        ? null
        : Math.max(1, parseInt(String(body.adminMaxBuyers), 10) || 1)

    if (!['approve', 'reject', 'request_changes', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: pack, error } = await admin.from('lead_packs').select('*').eq('id', id).single()
    if (error || !pack) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const patch: Record<string, unknown> = {
      reviewed_by: adminUser.userId,
      reviewed_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      const preview = (pack.preview_meta && typeof pack.preview_meta === 'object' ? pack.preview_meta : {}) as Record<string, unknown>
      const qualityScore = typeof preview.qualityScore === 'number' ? preview.qualityScore : null
      if (qualityScore !== null && qualityScore < 65) {
        return NextResponse.json({ error: 'QUALITY_SCORE_TOO_LOW', message: `Quality score ${qualityScore}/100 is below the 65-point minimum. Reject the pack or request corrections.` }, { status: 400 })
      }
      if (body?.qualityReviewConfirmed !== true) {
        return NextResponse.json({ error: 'QUALITY_REVIEW_CONFIRMATION_REQUIRED', message: 'Confirm you reviewed service relevance, need evidence, data quality, freshness, duplicates, and data rights.' }, { status: 400 })
      }
      if (adminMaxBuyers != null) {
        if (adminMaxBuyers > Number(pack.max_buyers)) {
          return NextResponse.json({ error: 'ADMIN_MAX_MUST_BE_LE_SELLER_MAX' }, { status: 400 })
        }
        if (adminMaxBuyers < Number(pack.sold_count)) {
          return NextResponse.json({ error: 'ADMIN_MAX_BELOW_SOLD' }, { status: 400 })
        }
        patch.admin_max_buyers = adminMaxBuyers
      }
      patch.status = 'approved'
      patch.reject_reason = null
    } else if (action === 'reject' || action === 'request_changes') {
      if (!rejectReason) return NextResponse.json({ error: 'REJECT_REASON_REQUIRED' }, { status: 400 })
      patch.status = 'rejected'
      patch.reject_reason = action === 'request_changes' ? `Changes requested: ${rejectReason}` : rejectReason
    } else {
      patch.status = 'suspended'
    }

    const { data: updated, error: upErr } = await admin
      .from('lead_packs')
      .update(patch)
      .eq('id', id)
      .select('id, status, admin_max_buyers, reject_reason')
      .single()

    if (upErr || !updated) {
      return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
    }

    await audit({
      actorId: adminUser.userId,
      actorEmail: adminUser.email,
      action: `lead_pack_${action}`,
      entity: 'lead_pack',
      entityId: id,
      oldValue: { status: pack.status },
      newValue: updated,
    })

    return NextResponse.json({ ok: true, pack: updated })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'ADMIN_ONLY') return NextResponse.json({ error: code }, { status: 403 })
    console.error('[admin/leads/moderate]', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
