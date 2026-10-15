/**
 * Admin-only margin view for agency landing orders.
 * Returns retail, fulfillment cost, and gross margin per order.
 * Never expose this endpoint to agency clients.
 */
import { NextRequest } from 'next/server'
import { adminJson, adminClient } from '@/lib/adminCore'

export async function GET(request: NextRequest) {
  return adminJson(async () => {
    const admin = adminClient()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
    const organizationId = (searchParams.get('organizationId') || '').trim()

    let attrQuery = admin
      .from('agency_order_attributions')
      .select(
        'project_id, organization_id, landing_page_id, retail_price, currency, customer_email, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (organizationId) attrQuery = attrQuery.eq('organization_id', organizationId)

    const { data: attrs, error } = await attrQuery
    if (error) return { error: error.message }

    const projectIds = (attrs ?? []).map((a) => a.project_id)
    const costByProject: Record<
      string,
      { fulfillment_cost: number; payment_status: string; status: string; title: string }
    > = {}

    if (projectIds.length) {
      const { data: projects } = await admin
        .from('projects')
        .select('id, fulfillment_cost, payment_status, status, title')
        .in('id', projectIds)
      for (const p of projects ?? []) {
        costByProject[p.id] = {
          fulfillment_cost: Number(p.fulfillment_cost || 0),
          payment_status: p.payment_status,
          status: p.status,
          title: p.title,
        }
      }
    }

    const orgIds = [...new Set((attrs ?? []).map((a) => a.organization_id))]
    const orgNames: Record<string, string> = {}
    if (orgIds.length) {
      const { data: orgs } = await admin.from('organizations').select('id, name').in('id', orgIds)
      for (const o of orgs ?? []) orgNames[o.id] = o.name
    }

    const rows = (attrs ?? []).map((a) => {
      const p = costByProject[a.project_id]
      const retail = Number(a.retail_price || 0)
      const cost = p?.fulfillment_cost ?? 0
      const margin = Math.round((retail - cost) * 100) / 100
      return {
        projectId: a.project_id,
        title: p?.title || 'Order',
        organizationId: a.organization_id,
        organizationName: orgNames[a.organization_id] || null,
        retailPrice: retail,
        fulfillmentCost: cost,
        grossMargin: margin,
        currency: a.currency || 'USD',
        paymentStatus: p?.payment_status || 'UNKNOWN',
        status: p?.status || 'UNKNOWN',
        customerEmail: a.customer_email,
        createdAt: a.created_at,
      }
    })

    const totals = rows.reduce(
      (acc, r) => {
        acc.retail += r.retailPrice
        acc.cost += r.fulfillmentCost
        acc.margin += r.grossMargin
        if (r.paymentStatus === 'PAYMENT_CONFIRMED') {
          acc.confirmedRetail += r.retailPrice
          acc.confirmedMargin += r.grossMargin
        }
        return acc
      },
      { retail: 0, cost: 0, margin: 0, confirmedRetail: 0, confirmedMargin: 0 },
    )

    const round = (n: number) => Math.round(n * 100) / 100

    return {
      rows,
      totals: {
        retail: round(totals.retail),
        fulfillmentCost: round(totals.cost),
        grossMargin: round(totals.margin),
        confirmedRetail: round(totals.confirmedRetail),
        confirmedMargin: round(totals.confirmedMargin),
        orderCount: rows.length,
      },
    }
  })
}
