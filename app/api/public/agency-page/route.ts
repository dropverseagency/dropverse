import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function anonOrService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get('slug') || '').trim().toLowerCase()
  if (!slug) return NextResponse.json({ error: 'MISSING_SLUG' }, { status: 400 })

  const db = anonOrService()
  const { data: page } = await db
    .from('agency_landing_pages')
    .select('id, slug, display_name, headline, description, logo_url, primary_color, published, organization_id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!page) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const { data: org } = await db
    .from('organizations')
    .select('plan, status')
    .eq('id', page.organization_id)
    .maybeSingle()

  if (!org || org.status !== 'active' || !['AGENCY', 'AGENCY_PRO', 'ENTERPRISE'].includes(org.plan)) {
    return NextResponse.json({ error: 'NOT_AVAILABLE' }, { status: 403 })
  }

  const { data: links } = await db
    .from('agency_landing_page_services')
    .select('service_id, sort_order')
    .eq('page_id', page.id)
    .order('sort_order')

  const serviceIds = (links || []).map((l) => l.service_id)
  if (!serviceIds.length) {
    return NextResponse.json({
      page: {
        display_name: page.display_name,
        headline: page.headline,
        description: page.description,
        logo_url: page.logo_url,
        primary_color: page.primary_color,
        slug: page.slug,
        services: [],
      },
    })
  }

  const { data: services } = await db
    .from('services')
    .select('id, title, slug, description, active')
    .in('id', serviceIds)
    .eq('active', true)

  const { data: packages } = await db
    .from('service_packages')
    .select('id, service_id, name, description, retail_price, currency, active, sort_order')
    .in('service_id', serviceIds)
    .eq('active', true)
    .order('sort_order')

  const servicesOut = (services || []).map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    description: s.description,
    packages: (packages || [])
      .filter((p) => p.service_id === s.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        retail_price: Number(p.retail_price),
        currency: p.currency || 'USD',
      })),
  }))

  return NextResponse.json({
    page: {
      display_name: page.display_name,
      headline: page.headline,
      description: page.description,
      logo_url: page.logo_url,
      primary_color: page.primary_color,
      slug: page.slug,
      services: servicesOut,
    },
  })
}
