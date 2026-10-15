/**
 * Admin read: agency landing pages + recent attributions (no fulfillment costs).
 */
import { NextRequest } from 'next/server'
import { adminJson, adminClient } from '@/lib/adminCore'

export async function GET(request: NextRequest) {
  return adminJson(async () => {
    const admin = adminClient()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)

    const { data: pages, error } = await admin
      .from('agency_landing_pages')
      .select(
        'id, organization_id, slug, display_name, published, published_at, primary_color, created_at, updated_at',
      )
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) return { error: error.message }

    const orgIds = [...new Set((pages ?? []).map((p) => p.organization_id))]
    const orgMap: Record<string, { name: string; plan: string }> = {}
    if (orgIds.length) {
      const { data: orgs } = await admin.from('organizations').select('id, name, plan').in('id', orgIds)
      for (const o of orgs ?? []) orgMap[o.id] = { name: o.name, plan: o.plan }
    }

    const { data: recentOrders } = await admin
      .from('agency_order_attributions')
      .select(
        'id, project_id, organization_id, landing_page_id, retail_price, currency, customer_email, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(30)

    return {
      pages: (pages ?? []).map((p) => ({
        ...p,
        organization_name: orgMap[p.organization_id]?.name || null,
        organization_plan: orgMap[p.organization_id]?.plan || null,
      })),
      recentOrders: recentOrders ?? [],
    }
  })
}
