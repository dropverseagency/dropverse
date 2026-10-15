import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireAgencyLandingAccess } from '../../../../lib/agency/landing'
import { adminClient } from '../../../../lib/adminCore'

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('organizationId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const access = await requireAgencyLandingAccess(supabase, user.id, orgId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 })

  const admin = adminClient()
  const { data: attrs } = await admin
    .from('agency_order_attributions')
    .select(
      'project_id, retail_price, currency, customer_name, customer_email, package_id, service_id, created_at, landing_page_id',
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  const projectIds = (attrs || []).map((a) => a.project_id)
  const projects: Record<string, { status: string; payment_status: string; title: string }> = {}
  if (projectIds.length) {
    const { data: rows } = await admin
      .from('projects')
      .select('id, status, payment_status, title')
      .in('id', projectIds)
    for (const r of rows || []) {
      projects[r.id] = { status: r.status, payment_status: r.payment_status, title: r.title }
    }
  }

  const orders = (attrs || []).map((a) => {
    const p = projects[a.project_id]
    return {
      projectId: a.project_id,
      title: p?.title || 'Order',
      status: p?.status || 'UNKNOWN',
      paymentStatus: p?.payment_status || 'UNKNOWN',
      retailPrice: Number(a.retail_price),
      currency: a.currency,
      customerName: a.customer_name,
      customerEmail: a.customer_email,
      createdAt: a.created_at,
    }
  })

  const totalRetail = orders.reduce((s, o) => s + Number(o.retailPrice || 0), 0)
  const confirmed = orders.filter((o) => o.paymentStatus === 'PAYMENT_CONFIRMED')
  const confirmedRetail = confirmed.reduce((s, o) => s + Number(o.retailPrice || 0), 0)

  return NextResponse.json({
    orders,
    summary: {
      orderCount: orders.length,
      totalRetail: Math.round(totalRetail * 100) / 100,
      confirmedCount: confirmed.length,
      confirmedRetail: Math.round(confirmedRetail * 100) / 100,
      // Fulfillment costs intentionally omitted for agency clients
    },
  })
}
