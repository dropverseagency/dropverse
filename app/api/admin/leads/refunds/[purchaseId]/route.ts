import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit, requireAdmin } from '@/lib/adminCore'

export const runtime = 'nodejs'

/**
 * POST /api/admin/leads/refunds/[purchaseId]
 * Refund only after a verified complaint (admin judgment).
 * Body: { reason: string, restoreSeat?: boolean }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ purchaseId: string }> },
) {
  try {
    const adminUser = await requireAdmin()
    const { purchaseId } = await ctx.params
    const body = (await request.json().catch(() => ({}))) as {
      reason?: string
      restoreSeat?: boolean
    }
    const reason = String(body?.reason || '').trim()
    const restoreSeat = body?.restoreSeat !== false

    if (!reason || reason.length < 5) {
      return NextResponse.json({ error: 'REASON_REQUIRED' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: purchase, error } = await admin
      .from('lead_pack_purchases')
      .select('id, pack_id, status, seller_net_usd')
      .eq('id', purchaseId)
      .single()

    if (error || !purchase) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    if (purchase.status !== 'paid') {
      return NextResponse.json({ error: 'NOT_PAID' }, { status: 409 })
    }

    const { data: pack, error: packErr } = await admin
      .from('lead_packs')
      .select('id, seller_id, sold_count, status')
      .eq('id', purchase.pack_id)
      .single()

    if (packErr || !pack) {
      return NextResponse.json({ error: 'PACK_NOT_FOUND' }, { status: 404 })
    }

    const { error: upErr } = await admin
      .from('lead_pack_purchases')
      .update({
        status: 'refunded',
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      })
      .eq('id', purchaseId)
      .eq('status', 'paid')

    if (upErr) return NextResponse.json({ error: 'REFUND_FAILED' }, { status: 500 })

    if (restoreSeat && Number(pack.sold_count) > 0) {
      const newSold = Number(pack.sold_count) - 1
      await admin
        .from('lead_packs')
        .update({
          sold_count: newSold,
          status: pack.status === 'sold_out' ? 'approved' : pack.status,
        })
        .eq('id', pack.id)
    }

    const debit = -Math.abs(Number(purchase.seller_net_usd))
    const { data: prior } = await admin
      .from('lead_marketplace_ledger')
      .select('amount')
      .eq('seller_id', pack.seller_id)
    const priorSum = (prior ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)
    const balanceAfter = Math.round((priorSum + debit) * 100) / 100

    await admin.from('lead_marketplace_ledger').insert({
      seller_id: pack.seller_id,
      purchase_id: purchaseId,
      event: 'refund_debit',
      amount: debit,
      balance_after: balanceAfter,
      note: reason,
    })

    await audit({
      actorId: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'lead_purchase_refunded',
      entity: 'lead_pack_purchase',
      entityId: purchaseId,
      newValue: { reason, restoreSeat, debit },
    })

    return NextResponse.json({ ok: true, refunded: true })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'ADMIN_ONLY') return NextResponse.json({ error: code }, { status: 403 })
    console.error('[admin/leads/refund]', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
