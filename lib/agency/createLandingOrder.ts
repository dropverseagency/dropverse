'use server'

/**
 * Creates a project from a public agency landing page order.
 * Uses service role after validating published page + package.
 * Does NOT mark payment confirmed.
 */
import { adminClient } from '../adminCore'
import { billingIntervalFor, computeFulfillmentCost, computeSellerProfit } from '../projectConfig'

export type LandingOrderInput = {
  slug: string
  packageId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  briefTitle: string
  briefNotes: string
  /** Public URLs of brief files uploaded via /api/public/agency-order/upload */
  attachmentUrls?: string[]
  idempotencyKey?: string
}

export async function createLandingPageOrder(input: LandingOrderInput) {
  const slug = String(input.slug || '').trim().toLowerCase()
  const packageId = String(input.packageId || '').trim()
  const customerEmail = String(input.customerEmail || '').trim().toLowerCase()
  const customerName = String(input.customerName || '').trim()
  const briefTitle = String(input.briefTitle || '').trim()
  const briefNotes = String(input.briefNotes || '').trim()
  const attachmentUrls = (input.attachmentUrls || [])
    .map((u) => String(u || '').trim())
    .filter((u) => /^https:\/\//i.test(u))
    .slice(0, 5)
  const idempotencyKey = input.idempotencyKey?.trim() || null

  if (!slug || !packageId) return { error: 'INVALID_INPUT' as const }
  if (!customerName || customerName.length < 2) return { error: 'INVALID_NAME' as const }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return { error: 'INVALID_EMAIL' as const }
  if (!briefTitle || briefTitle.length < 3) return { error: 'INVALID_TITLE' as const }

  const admin = adminClient()

  const { data: page } = await admin
    .from('agency_landing_pages')
    .select('id, organization_id, display_name, published, slug')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!page) return { error: 'PAGE_NOT_FOUND' as const }

  const { data: org } = await admin
    .from('organizations')
    .select('id, plan, owner_id, status')
    .eq('id', page.organization_id)
    .maybeSingle()

  if (!org || org.status !== 'active') return { error: 'ORG_INACTIVE' as const }

  const plan = org.plan as string
  if (!['AGENCY', 'AGENCY_PRO', 'ENTERPRISE'].includes(plan)) {
    return { error: 'PLAN_REQUIRED' as const }
  }

  if (idempotencyKey) {
    const { data: existing } = await admin
      .from('agency_order_attributions')
      .select('project_id')
      .eq('landing_page_id', page.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (existing?.project_id) {
      const { data: existingProject } = await admin
        .from('projects')
        .select('client_price, currency')
        .eq('id', existing.project_id)
        .maybeSingle()
      return {
        success: true as const,
        projectId: existing.project_id as string,
        duplicate: true as const,
        amount: Number(existingProject?.client_price || 0) || undefined,
        currency: (existingProject?.currency as string) || 'USD',
      }
    }
  }

  const { data: pkg } = await admin
    .from('service_packages')
    .select('id, service_id, name, retail_price, currency, active')
    .eq('id', packageId)
    .eq('active', true)
    .maybeSingle()

  if (!pkg) return { error: 'PACKAGE_NOT_FOUND' as const }

  const { data: link } = await admin
    .from('agency_landing_page_services')
    .select('service_id')
    .eq('page_id', page.id)
    .eq('service_id', pkg.service_id)
    .maybeSingle()

  if (!link) return { error: 'PACKAGE_NOT_ON_PAGE' as const }

  const { data: service } = await admin
    .from('services')
    .select('id, title, active')
    .eq('id', pkg.service_id)
    .eq('active', true)
    .maybeSingle()

  if (!service) return { error: 'SERVICE_INACTIVE' as const }

  const retailPrice = Math.round(Number(pkg.retail_price) * 100) / 100
  if (!(retailPrice > 0)) return { error: 'INVALID_PRICE' as const }

  const projectType = 'ONE_TIME' as const
  const fulfillmentCost = computeFulfillmentCost(projectType, retailPrice)
  const sellerProfit = computeSellerProfit(retailPrice, fulfillmentCost)

  const title = briefTitle.slice(0, 200)
  const attachmentBlock =
    attachmentUrls.length > 0
      ? ['', 'Attachments:', ...attachmentUrls.map((u, i) => `${i + 1}. ${u}`)].join('\n')
      : ''

  const description = [
    `Agency landing order via /a/${page.slug}`,
    `Agency: ${page.display_name}`,
    `Service: ${service.title}`,
    `Package: ${pkg.name}`,
    `Customer: ${customerName} <${customerEmail}>`,
    input.customerPhone ? `Phone: ${String(input.customerPhone).trim()}` : null,
    '',
    briefNotes.slice(0, 4000),
    attachmentBlock,
  ]
    .filter(Boolean)
    .join('\n')

  // Prefer SPACEREMIT when public key is configured; otherwise CLIENT_PAYS_DROPVERSE
  // (valid CHECK value) so the order still enters the existing workflow.
  const spaceremitPublic = (process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || '').trim()
  const useSpaceRemit = Boolean(spaceremitPublic) && !spaceremitPublic.startsWith('PLACEHOLDER')
  const paymentMethod = useSpaceRemit ? 'SPACEREMIT' : 'CLIENT_PAYS_DROPVERSE'
  const paymentProvider = useSpaceRemit ? 'SPACEREMIT' : null

  const projectRow: Record<string, unknown> = {
    user_id: org.owner_id,
    title,
    description,
    project_type: projectType,
    billing_interval: billingIntervalFor(projectType),
    currency: pkg.currency || 'USD',
    client_price: retailPrice,
    fulfillment_cost: fulfillmentCost,
    seller_profit: sellerProfit,
    payment_method: paymentMethod,
    payment_status: 'PAYMENT_PENDING',
    status: 'DRAFT',
    current_billing_period: 1,
    delivery_notes: (briefNotes + (attachmentUrls.length ? '\n\nFiles:\n' + attachmentUrls.join('\n') : '')).slice(0, 4000),
    client_contact_email: customerEmail,
  }

  const withOrg = paymentProvider
    ? { ...projectRow, organization_id: org.id, payment_provider: paymentProvider }
    : { ...projectRow, organization_id: org.id }

  let projectId: string | null = null
  {
    const res = await admin.from('projects').insert(withOrg).select('id').single()
    if (!res.error && res.data?.id) {
      projectId = res.data.id
    } else if (res.error && /organization_id|payment_provider/i.test(res.error.message || '')) {
      const res2 = await admin.from('projects').insert(projectRow).select('id').single()
      if (res2.error || !res2.data?.id) {
        console.error('[agency-order] project insert failed', res2.error?.code, res2.error?.message)
        return { error: 'DB_ERROR' as const }
      }
      projectId = res2.data.id
    } else {
      console.error('[agency-order] project insert failed', res.error?.code, res.error?.message)
      return { error: 'DB_ERROR' as const }
    }
  }

  const { error: attrErr } = await admin.from('agency_order_attributions').insert({
    project_id: projectId,
    organization_id: org.id,
    landing_page_id: page.id,
    package_id: pkg.id,
    service_id: service.id,
    retail_price: retailPrice,
    currency: pkg.currency || 'USD',
    customer_name: customerName,
    customer_email: customerEmail,
    idempotency_key: idempotencyKey,
  })

  if (attrErr) {
    console.error('[agency-order] attribution failed', attrErr.code, attrErr.message)
    await admin.from('projects').delete().eq('id', projectId)
    return { error: 'ATTRIBUTION_FAILED' as const }
  }

  await admin.from('audit_logs').insert({
    actor_id: null,
    actor_email: customerEmail,
    action: 'agency_landing_order_created',
    entity: 'project',
    entity_id: projectId,
    new_value: JSON.stringify({
      landing_page_id: page.id,
      organization_id: org.id,
      package_id: pkg.id,
      retail_price: retailPrice,
    }),
  })

  return {
    success: true as const,
    projectId: projectId!,
    amount: retailPrice,
    currency: pkg.currency || 'USD',
    packageName: pkg.name,
    serviceTitle: service.title,
    agencyName: page.display_name,
  }
}
