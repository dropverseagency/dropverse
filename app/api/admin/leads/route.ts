import { NextRequest, NextResponse } from 'next/server'
import { adminClient, adminJson, parsePage } from '@/lib/adminCore'

export const runtime = 'nodejs'

/** GET /api/admin/leads?status=pending_review */
export async function GET(request: NextRequest) {
  return adminJson(async () => {
    const status = (request.nextUrl.searchParams.get('status') || 'pending_review').trim()
    const { offset, limit } = parsePage(request.nextUrl.searchParams)
    const admin = adminClient()
    let q = admin
      .from('lead_packs')
      .select(
        'id, seller_id, title, description, niche, countries, price_usd, max_buyers, admin_max_buyers, sold_count, status, preview_meta, source_attestation, resale_rights_ack, file_bytes, file_content_type, reject_reason, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (status !== 'all') q = q.eq('status', status)

    const { data, error, count } = await q
    if (error) throw new Error(error.message)
    return { items: data ?? [], total: count ?? 0 }
  })
}
