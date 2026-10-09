import { adminClient, adminJson } from '@/lib/adminCore'

const PUBLIC = ['/', '/pricing', '/earn', '/services', '/privacy', '/terms', '/contact', '/samples']

export async function GET() {
  return adminJson(async () => {
    const admin = adminClient()
    const sinceLive = new Date(Date.now() - 60 * 1000).toISOString()
    const sinceMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [live, views] = await Promise.all([
      admin.from('site_presence').select('visitor_id, path, last_seen').gte('last_seen', sinceLive).order('last_seen', { ascending: false }).limit(50),
      admin.from('page_views').select('path').gte('created_at', sinceMonth).limit(5000),
    ])
    if (live.error) return { ready: false, online: 0, pages: [], visitors30d: null }
    const rows = live.data ?? []
    const pages = new Map<string, number>()
    for (const row of rows) pages.set(row.path, (pages.get(row.path) ?? 0) + 1)
    const visitors30d = views.error
      ? null
      : (views.data ?? []).filter((row) => PUBLIC.some((p) => row.path === p || (p !== '/' && String(row.path || '').startsWith(p + '/')))).length
    return {
      ready: true,
      online: rows.length,
      visitors30d,
      pages: [...pages.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count),
      visitors: rows.map((row) => ({ path: row.path, lastSeen: row.last_seen })),
    }
  })
}
