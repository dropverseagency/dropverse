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

  return NextResponse.json({
    items: data ?? [],
    page,
    limit,
    total: count ?? 0,
  })
}
