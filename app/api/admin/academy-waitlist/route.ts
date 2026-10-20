import { adminClient, adminJson, parsePage } from '@/lib/adminCore'

/**
 * GET /api/admin/academy-waitlist
 * Admin-only list of Advanced Academy notify-me signups.
 */
export async function GET(request: Request) {
  return adminJson(async () => {
    const url = new URL(request.url)
    const { offset, limit } = parsePage(url.searchParams)
    const admin = adminClient()

    const { data, error, count } = await admin
      .from('academy_waitlist')
      .select('id, email, user_id, source, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[admin/academy-waitlist]', error)
      return { error: 'LOAD_FAILED', items: [], total: 0 }
    }

    return {
      items: data ?? [],
      total: count ?? (data?.length ?? 0),
      limit,
      offset,
    }
  })
}
