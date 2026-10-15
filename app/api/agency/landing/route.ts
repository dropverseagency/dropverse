/**
 * Authenticated agency landing page management.
 * GET: load page for org. PUT: upsert draft. POST action=publish|unpublish
 * Server enforces paid-plan eligibility; UI is not the security boundary.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { planAllowsAgencyLanding } from '../../../../lib/planConfig'
import {
  isValidAgencySlug,
  isValidHexColor,
  requireAgencyLandingAccess,
  slugifyAgency,
} from '../../../../lib/agency/landing'

async function sessionClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  )
}

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('organizationId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })

  const supabase = await sessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const access = await requireAgencyLandingAccess(supabase, user.id, orgId)
  if (!access.ok) {
    const status = access.error === 'PLAN_REQUIRED' ? 402 : 403
    return NextResponse.json({ error: access.error }, { status })
  }

  const { data: page } = await supabase
    .from('agency_landing_pages')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  let serviceIds: string[] = []
  if (page?.id) {
    const { data: links } = await supabase
      .from('agency_landing_page_services')
      .select('service_id, sort_order')
      .eq('page_id', page.id)
      .order('sort_order')
    serviceIds = (links || []).map((l) => l.service_id)
  }

  const { data: services } = await supabase
    .from('services')
    .select('id, title, slug, description, active')
    .eq('active', true)
    .order('title')

  return NextResponse.json({
    eligible: true,
    plan: access.org.plan,
    page,
    serviceIds,
    catalog: services || [],
  })
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const orgId = String(body.organizationId || '')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })

  const supabase = await sessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const access = await requireAgencyLandingAccess(supabase, user.id, orgId)
  if (!access.ok) {
    const status = access.error === 'PLAN_REQUIRED' ? 402 : 403
    return NextResponse.json({ error: access.error }, { status })
  }

  const displayName = String(body.displayName || access.org.name).trim().slice(0, 120)
  let slug = String(body.slug || slugifyAgency(displayName)).trim().toLowerCase()
  slug = slugifyAgency(slug)
  if (!isValidAgencySlug(slug)) return NextResponse.json({ error: 'INVALID_SLUG' }, { status: 400 })

  const primaryColor = String(body.primaryColor || '#e2b656').trim()
  if (!isValidHexColor(primaryColor)) return NextResponse.json({ error: 'INVALID_COLOR' }, { status: 400 })

  const headline = String(body.headline || '').trim().slice(0, 200)
  const description = String(body.description || '').trim().slice(0, 2000)
  const logoUrl = body.logoUrl ? String(body.logoUrl).trim().slice(0, 500) : null
  const serviceIds = Array.isArray(body.serviceIds)
    ? [...new Set(body.serviceIds.map((x: unknown) => String(x)))].slice(0, 24)
    : []

  const { data: clash } = await supabase
    .from('agency_landing_pages')
    .select('id, organization_id')
    .eq('slug', slug)
    .maybeSingle()
  if (clash && clash.organization_id !== orgId) {
    return NextResponse.json({ error: 'SLUG_TAKEN' }, { status: 409 })
  }

  const { data: existing } = await supabase
    .from('agency_landing_pages')
    .select('id')
    .eq('organization_id', orgId)
    .maybeSingle()

  const payload = {
    organization_id: orgId,
    slug,
    display_name: displayName,
    headline,
    description,
    logo_url: logoUrl,
    primary_color: primaryColor,
    updated_at: new Date().toISOString(),
    created_by: user.id,
  }

  let pageId: string
  if (existing?.id) {
    const { data, error } = await supabase
      .from('agency_landing_pages')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'SAVE_FAILED', detail: error?.message }, { status: 500 })
    }
    pageId = data.id
  } else {
    const { data, error } = await supabase
      .from('agency_landing_pages')
      .insert({ ...payload, published: false })
      .select('id')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'SAVE_FAILED', detail: error?.message }, { status: 500 })
    }
    pageId = data.id
  }

  await supabase.from('agency_landing_page_services').delete().eq('page_id', pageId)
  if (serviceIds.length) {
    await supabase.from('agency_landing_page_services').insert(
      serviceIds.map((service_id, i) => ({ page_id: pageId, service_id, sort_order: i })),
    )
  }

  return NextResponse.json({ ok: true, pageId, slug })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const orgId = String(body.organizationId || '')
  const action = String(body.action || '')
  if (!orgId || !['publish', 'unpublish'].includes(action)) {
    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  }

  const supabase = await sessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const access = await requireAgencyLandingAccess(supabase, user.id, orgId)
  if (!access.ok) {
    const status = access.error === 'PLAN_REQUIRED' ? 402 : 403
    return NextResponse.json({ error: access.error }, { status })
  }

  if (action === 'publish' && !planAllowsAgencyLanding(access.org.plan)) {
    return NextResponse.json({ error: 'PLAN_REQUIRED' }, { status: 402 })
  }

  const { data: page } = await supabase
    .from('agency_landing_pages')
    .select('id, slug, display_name')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!page) return NextResponse.json({ error: 'PAGE_MISSING' }, { status: 404 })

  if (action === 'publish') {
    const { data: links } = await supabase
      .from('agency_landing_page_services')
      .select('service_id')
      .eq('page_id', page.id)
    const serviceIds = (links || []).map((l) => l.service_id)
    if (!serviceIds.length) {
      return NextResponse.json({ error: 'NO_SERVICES' }, { status: 400 })
    }

    // Require at least one active retail package on selected services.
    const { data: pkgs } = await supabase
      .from('service_packages')
      .select('id')
      .in('service_id', serviceIds)
      .eq('active', true)
      .limit(1)
    if (!pkgs?.length) {
      return NextResponse.json(
        { error: 'NO_PACKAGES', message: 'Add active packages in Admin → Packages before publishing.' },
        { status: 400 },
      )
    }
  }

  const now = new Date().toISOString()
  const patch =
    action === 'publish'
      ? { published: true, published_at: now, updated_at: now }
      : { published: false, updated_at: now }

  const { error } = await supabase.from('agency_landing_pages').update(patch).eq('id', page.id)

  if (error) return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true, published: action === 'publish', slug: page.slug })
}
