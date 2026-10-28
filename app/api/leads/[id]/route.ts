import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'
import { effectiveMaxBuyers, remainingSeats } from '@/lib/leads/types'

export const runtime = 'nodejs'

/** GET /api/leads/[id] — public detail; never returns storage_path. */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

  const admin = adminClient()
  const { data: pack, error } = await admin
    .from('lead_packs')
    .select(
      'id, seller_id, title, description, niche, countries, price_usd, currency, max_buyers, admin_max_buyers, sold_count, status, preview_meta, created_at, updated_at',
    )
    .eq('id', id)
    .single()

  if (error || !pack) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  if (pack.status !== 'approved' && pack.status !== 'sold_out') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const effective = effectiveMaxBuyers(Number(pack.max_buyers), pack.admin_max_buyers)
  const soldRemaining = remainingSeats(Number(pack.max_buyers), pack.admin_max_buyers, Number(pack.sold_count))
  const { count: pendingReservations, error: reservationError } = await admin
    .from('lead_pack_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('pack_id', id)
    .eq('status', 'pending_payment')
    .gt('expires_at', new Date().toISOString())
  if (reservationError) {
    console.error('[leads] detail reservations', reservationError.message)
    return NextResponse.json({ error: 'DETAIL_FAILED' }, { status: 500 })
  }
  const remaining = Math.max(0, soldRemaining - Number(pendingReservations ?? 0))

  return NextResponse.json({
    ...pack,
    effective_max_buyers: effective,
    remaining_seats: remaining,
  })
}
