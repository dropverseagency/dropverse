/**
 * Admin CRUD for service_packages (retail SKUs for agency landing pages).
 * Auth: adminJson (admin only). Does not expose fulfillment costs.
 */
import { NextRequest } from 'next/server'
import { adminJson, adminClient, invalidate, audit } from '@/lib/adminCore'

export async function GET(request: NextRequest) {
  return adminJson(async () => {
    const { searchParams } = new URL(request.url)
    const serviceId = (searchParams.get('serviceId') || '').trim()
    const admin = adminClient()
    let query = admin
      .from('service_packages')
      .select('id, service_id, name, description, retail_price, currency, sort_order, active, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200)
    if (serviceId) query = query.eq('service_id', serviceId)
    const { data, error } = await query
    if (error) return { error: error.message }

    const ids = [...new Set((data ?? []).map((r) => r.service_id))]
    const titles: Record<string, string> = {}
    if (ids.length) {
      const { data: svcs } = await admin.from('services').select('id, title').in('id', ids)
      for (const s of svcs ?? []) titles[s.id] = s.title
    }

    const { data: services } = await admin
      .from('services')
      .select('id, title, active')
      .order('title', { ascending: true })

    return {
      rows: (data ?? []).map((r) => ({ ...r, service_title: titles[r.service_id] || null })),
      services: services ?? [],
    }
  })
}

export async function POST(request: NextRequest) {
  return adminJson(async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const serviceId = String(body.serviceId ?? '').trim()
    const name = String(body.name ?? '').trim()
    const description = String(body.description ?? '').trim()
    const retailPrice = Number(body.retailPrice ?? 0)
    if (!serviceId || !name) return { error: 'MISSING_FIELDS' }
    if (!(retailPrice > 0)) return { error: 'INVALID_PRICE' }

    const admin = adminClient()
    const { data: svc } = await admin.from('services').select('id').eq('id', serviceId).maybeSingle()
    if (!svc) return { error: 'SERVICE_NOT_FOUND' }

    const { data, error } = await admin
      .from('service_packages')
      .insert({
        service_id: serviceId,
        name,
        description,
        retail_price: retailPrice,
        currency: String(body.currency || 'USD').trim().toUpperCase() || 'USD',
        sort_order: Number(body.sortOrder ?? 0) || 0,
        active: body.active !== false,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) return { error: error.message }

    await audit({
      actorId: ctx.userId,
      actorEmail: ctx.email,
      action: 'package_created',
      entity: 'service_packages',
      entityId: data?.id,
      newValue: { serviceId, name, retailPrice },
    })
    invalidate()
    return { ok: true, id: data?.id }
  })
}

export async function PATCH(request: NextRequest) {
  return adminJson(async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const packageId = String(body.packageId ?? '').trim()
    if (!packageId) return { error: 'MISSING_PACKAGE_ID' }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === 'string') patch.name = body.name.trim()
    if (typeof body.description === 'string') patch.description = body.description.trim()
    if (body.retailPrice != null) {
      const retailPrice = Number(body.retailPrice)
      if (!(retailPrice > 0)) return { error: 'INVALID_PRICE' }
      patch.retail_price = retailPrice
    }
    if (typeof body.active === 'boolean') patch.active = body.active
    if (body.sortOrder != null) patch.sort_order = Number(body.sortOrder) || 0

    const admin = adminClient()
    const { error } = await admin.from('service_packages').update(patch).eq('id', packageId)
    if (error) return { error: error.message }

    await audit({
      actorId: ctx.userId,
      actorEmail: ctx.email,
      action: 'package_updated',
      entity: 'service_packages',
      entityId: packageId,
      newValue: patch,
    })
    invalidate()
    return { ok: true }
  })
}
