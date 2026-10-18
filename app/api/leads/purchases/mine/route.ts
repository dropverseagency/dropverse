import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'

export const runtime = 'nodejs'

/** GET /api/leads/purchases/mine */
export async function GET() {
  try {
    const { userId } = await requireUser()
    const admin = adminClient()
    const { data, error } = await admin
      .from('lead_pack_purchases')
      .select(
        'id, pack_id, price_usd, status, paid_at, created_at, lead_packs(id, title, niche, status)',
      )
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'LIST_FAILED' }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
