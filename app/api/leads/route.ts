import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

/** GET /api/leads — public catalog of approved packs (no storage paths). */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const niche = (sp.get('niche') || '').trim()
  const q = (sp.get('q') || '').trim()
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') || '24', 10) || 24))
  const offset = (page - 1) * limit

  const admin = adminClient()
  let query = admin
    .from('lead_packs_public')
    .select('*', { count: 'exact' })
    .eq('status', 'approved')
    .gt('remaining_seats', 0)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (niche) query = query.ilike('niche', `%${niche}%`)
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error, count } = await query
  if (error) {
    console.error('[leads] list', error.message)
    return NextResponse.json({ error: 'LIST_FAILED' }, { status: 500 })
  }

  const packs = data ?? []
  const pendingCounts = new Map<string, number>()
  if (packs.length) {
    const { data: reservations, error: reservationsError } = await admin
      .from('lead_pack_purchases')
      .select('pack_id')
      .in('pack_id', packs.map((item) => item.id))
      .eq('status', 'pending_payment')
      .gt('expires_at', new Date().toISOString())

    if (reservationsError) {
      console.error('[leads] active reservations', reservationsError.message)
      return NextResponse.json({ error: 'LIST_FAILED' }, { status: 500 })
    }
    for (const reservation of reservations ?? []) {
      pendingCounts.set(reservation.pack_id, (pendingCounts.get(reservation.pack_id) ?? 0) + 1)
    }
  }

  return NextResponse.json({
    items: packs.map((item) => ({
      ...item,
      reserved_seats: pendingCounts.get(item.id) ?? 0,
      remaining_seats: Math.max(0, Number(item.remaining_seats ?? 0) - (pendingCounts.get(item.id) ?? 0)),
    })),
    page,
    limit,
    total: count ?? 0,
  })
}
