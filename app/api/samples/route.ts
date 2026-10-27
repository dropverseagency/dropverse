import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { adminClient, audit, sessionClient } from '@/lib/adminCore'
import { samplesSessionWritesEnabled } from '@/lib/samplesWriteMode'
import { runSampleReviewAgent } from '@/lib/agents/sampleReviewAgent'
import { notifyAdminEvent } from '@/lib/agents/adminNotify'
import { requireUser } from '@/lib/leads/auth'
import {
  isFreelancerProfile,
  SAMPLE_CATEGORIES,
  SAMPLE_COVER_BUCKET,
  SAMPLE_MAX_FILE_BYTES,
  SAMPLE_MAX_FILES,
  SAMPLE_ORIGINAL_BUCKET,
  SAMPLE_RIGHTS_TERMS_VERSION,
  safeSampleFilename,
  sampleFileKind,
  slugifySample,
  parseSampleRevisionTerms,
} from '@/lib/samples'
import { limitPublicForm, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'

function publicSample(item: Record<string, any>, publicOnly = false) {
  const coverPath = item.cover_path as string | null
  const { data } = coverPath
    ? adminClient().storage.from(SAMPLE_COVER_BUCKET).getPublicUrl(coverPath)
    : { data: { publicUrl: null } }

  if (publicOnly) {
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      category: item.category,
      description: item.description,
      price_usd: item.price_usd,
      turnaround_days: item.turnaround_days,
      revision_limit: item.revision_limit,
      revision_price_usd: item.revision_price_usd,
      scope: item.scope,
      deliverables: item.deliverables,
      client_requirements: item.client_requirements,
      minimum_resale_price_usd: item.minimum_resale_price_usd,
      sla_response_hours: item.sla_response_hours,
      sla_delivery_days: item.sla_delivery_days,
      service_importance: item.service_importance,
      freelancer_available: item.freelancer_available,
      next_available_at: item.next_available_at,
      verified_level: item.verified_level,
      metrics: item.metrics || null,
      addons: item.addons || [],
      created_at: item.created_at,
      freelancer_display_name: item.freelancer_display_name,
      freelancer_category: item.freelancer_category,
      cover_url: data.publicUrl,
    }
  }

  return { ...item, cover_url: data.publicUrl }
}

async function getProfile(userId: string) {
  const admin = adminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, username, user_type, user_types')
    .eq('id', userId)
    .single()
  if (error || !data) throw new Error('PROFILE_NOT_FOUND')
  if (!isFreelancerProfile(data)) throw new Error('FREELANCER_ONLY')
  return data
}

/** GET /api/samples — public approved catalogue, or own submissions with ?mine=1. */
export async function GET(request: NextRequest) {
  const mine = request.nextUrl.searchParams.get('mine') === '1'
  const id = request.nextUrl.searchParams.get('id')?.trim()
  const slug = request.nextUrl.searchParams.get('slug')?.trim()
  const admin = adminClient()
  try {
    if (mine) {
      const { userId } = await requireUser()
      await getProfile(userId)
      const { data, error } = await admin
        .from('samples')
        .select('id, title, slug, category, description, scope, deliverables, client_requirements, minimum_resale_price_usd, sla_response_hours, sla_delivery_days, service_importance, status, price_usd, turnaround_days, revision_limit, revision_price_usd, rejection_reason, cover_path, created_at, updated_at, sample_costs(cost_usd), sample_addons(id,name,description,price_usd,extra_days,active), sample_files(id, kind, mime, size_bytes)')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ items: (data ?? []).map((item) => publicSample(item)) })
    }

    if (id || slug) {
      let query = admin
        .from('samples')
        .select('id, owner_id, title, slug, category, description, scope, deliverables, client_requirements, minimum_resale_price_usd, sla_response_hours, sla_delivery_days, service_importance, status, price_usd, turnaround_days, revision_limit, revision_price_usd, cover_path, created_at')
        .eq('status', 'approved')
      query = id ? query.eq('id', id) : query.eq('slug', slug!)
      const { data: sample, error: sampleError } = await query.maybeSingle()
      if (sampleError) throw sampleError
      if (!sample) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      const { data: freelancer } = await admin
        .from('freelancer_profiles')
        .select('display_name, category')
        .eq('user_id', sample.owner_id)
        .maybeSingle()
      const [{ data: availability }, { data: verification }, { data: metrics }, { data: addons }] = await Promise.all([
        admin.from('freelancer_availability').select('available,next_available_at').eq('user_id', sample.owner_id).maybeSingle(),
        admin.from('freelancer_verifications').select('verified_level').eq('user_id', sample.owner_id).maybeSingle(),
        admin.from('freelancer_metrics').select('on_time_delivery_rate,completion_rate,average_response_minutes,dispute_rate,average_rating,rating_count,paid_completed_projects').eq('user_id', sample.owner_id).maybeSingle(),
        admin.from('sample_addons').select('id,name,description,price_usd,extra_days').eq('sample_id', sample.id).eq('active', true).order('sort_order'),
      ])
      return NextResponse.json({
        sample: publicSample({
          ...sample,
          freelancer_display_name: freelancer?.display_name ?? null,
          freelancer_category: freelancer?.category ?? null,
          freelancer_available: availability?.available ?? true,
          next_available_at: availability?.next_available_at ?? null,
          verified_level: verification?.verified_level ?? 'none',
          metrics,
          addons,
        }, true),
      })
    }

    const { data, error } = await admin
      .from('samples_public')
      .select('id, title, slug, category, description, price_usd, turnaround_days, cover_path, created_at, freelancer_display_name, freelancer_category')
      .order('created_at', { ascending: false })
    if (error) throw error
    const publicItems = data ?? []
    const ids = publicItems.map((item) => item.id)
    const { data: terms, error: termsError } = ids.length
      ? await admin.from('samples').select('id, revision_limit, revision_price_usd').in('id', ids)
      : { data: [], error: null }
    if (termsError) throw termsError
    const termsById = new Map((terms ?? []).map((item) => [item.id, item]))
    return NextResponse.json({ items: publicItems.map((item) => publicSample({ ...item, ...termsById.get(item.id) }, true)) })
  } catch (e) {
    const code = (e as Error).message
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'FREELANCER_ONLY') return NextResponse.json({ error: code }, { status: 403 })
    if (code === 'PROFILE_NOT_FOUND') return NextResponse.json({ error: code }, { status: 403 })
    console.error('[samples GET]', code)
    return NextResponse.json({ error: 'SAMPLES_UNAVAILABLE' }, { status: 503 })
  }
}

/** POST /api/samples — freelancer uploads a sample and submits it for admin review. */
export async function POST(request: NextRequest) {
  void samplesSessionWritesEnabled
  const rl = await limitPublicForm(request)
  if (!rl.success) return rateLimitResponse(rl, 'Too many uploads. Please wait and try again.')

  let sampleId: string | null = null
  const uploadedOriginals: string[] = []
  let uploadedCover: string | null = null
  try {
    const { userId, email } = await requireUser()
    const profile = await getProfile(userId)
    const form = await request.formData()
    const title = String(form.get('title') || '').trim()
    const description = String(form.get('description') || '').trim()
    const category = String(form.get('category') || '').trim()
    const turnaroundDays = Number(form.get('turnaround_days') || 3)
    const priceUsdRaw = String(form.get('price_usd') || '').trim()
    const priceUsd = priceUsdRaw ? Number(priceUsdRaw) : null
    const costUsd = Number(form.get('cost_usd') || 0)
    const scope = String(form.get('scope') || '').trim()
    const deliverables = String(form.get('deliverables') || '').trim()
    const clientRequirements = String(form.get('client_requirements') || '').trim()
    const minimumResalePrice = Number(form.get('minimum_resale_price_usd') || 0)
    const slaResponseHours = Number(form.get('sla_response_hours') || 24)
    const serviceImportance = String(form.get('service_importance') || 'standard')
    let addons: Array<{name:string;description?:string;priceUsd:number;extraDays:number}> = []
    try { addons = JSON.parse(String(form.get('addons') || '[]')) } catch { return NextResponse.json({ error: 'INVALID_ADDONS' }, { status: 400 }) }
    const revisionTerms = parseSampleRevisionTerms(form.get('revision_limit'), form.get('revision_price_usd'))
    const rightsConfirmed = form.get('rights_confirmed') === 'true'
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    const cover = form.get('cover')

    if (title.length < 3 || title.length > 120) return NextResponse.json({ error: 'INVALID_TITLE' }, { status: 400 })
    if (description.length > 1000) return NextResponse.json({ error: 'DESCRIPTION_TOO_LONG' }, { status: 400 })
    if (!(SAMPLE_CATEGORIES as readonly string[]).includes(category)) return NextResponse.json({ error: 'INVALID_CATEGORY' }, { status: 400 })
    if (!Number.isInteger(turnaroundDays) || turnaroundDays < 1 || turnaroundDays > 30) return NextResponse.json({ error: 'INVALID_TURNAROUND' }, { status: 400 })
    if (priceUsd !== null && (!Number.isFinite(priceUsd) || priceUsd < 0 || priceUsd > 1000000)) return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 })
    if (!Number.isFinite(costUsd) || costUsd < 1 || costUsd > 5000) return NextResponse.json({ error: 'INVALID_COST' }, { status: 400 })
    if (scope.length < 10 || scope.length > 3000 || deliverables.length < 5 || deliverables.length > 2000 || clientRequirements.length > 2000) return NextResponse.json({ error: 'INVALID_SERVICE_DETAILS' }, { status: 400 })
    if (!Number.isFinite(minimumResalePrice) || minimumResalePrice < costUsd || minimumResalePrice > 1000000) return NextResponse.json({ error: 'INVALID_MINIMUM_RESALE_PRICE' }, { status: 400 })
    if (!Number.isInteger(slaResponseHours) || slaResponseHours < 1 || slaResponseHours > 168 || !['standard','important','critical'].includes(serviceImportance)) return NextResponse.json({ error: 'INVALID_SLA' }, { status: 400 })
    if (!Array.isArray(addons) || addons.length > 8 || addons.some((a) => String(a.name||'').trim().length < 2 || !Number.isFinite(Number(a.priceUsd)) || Number(a.priceUsd)<0 || Number(a.extraDays)<0 || Number(a.extraDays)>30)) return NextResponse.json({ error: 'INVALID_ADDONS' }, { status: 400 })
    if (!revisionTerms.value) return NextResponse.json({ error: 'INVALID_REVISION_TERMS', message: revisionTerms.error }, { status: 400 })
    if (!rightsConfirmed) return NextResponse.json({ error: 'RIGHTS_CONFIRMATION_REQUIRED' }, { status: 400 })
    if (files.length < 1 || files.length > SAMPLE_MAX_FILES) return NextResponse.json({ error: 'FILES_REQUIRED_OR_LIMIT_EXCEEDED' }, { status: 400 })
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0) + (cover instanceof File && cover.size > 0 ? cover.size : 0)
    if (totalBytes > 100 * 1024 * 1024) return NextResponse.json({ error: 'TOTAL_UPLOAD_TOO_LARGE' }, { status: 400 })
    for (const file of files) {
      if (file.size > SAMPLE_MAX_FILE_BYTES || !sampleFileKind((file.type || '').toLowerCase())) {
        return NextResponse.json({ error: 'INVALID_FILE_TYPE_OR_SIZE' }, { status: 400 })
      }
    }
    if (cover instanceof File && cover.size > 0 && (
      cover.size > 15 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes((cover.type || '').toLowerCase())
    )) return NextResponse.json({ error: 'INVALID_COVER' }, { status: 400 })

    const admin = adminClient()
    const displayName = String(profile.full_name || profile.username || email?.split('@')[0] || 'Freelancer').trim().slice(0, 80)
    const { data: existingFreelancerProfile, error: existingProfileError } = await admin.from('freelancer_profiles').select('user_id').eq('user_id', userId).maybeSingle()
    if (existingProfileError) throw new Error('FREELANCER_PROFILE_CHECK_FAILED')
    if (!existingFreelancerProfile) {
      const { error: profileError } = await admin.from('freelancer_profiles').insert({ user_id: userId, display_name: displayName.length >= 2 ? displayName : 'Freelancer', category, bio: '' })
      if (profileError) throw new Error('FREELANCER_PROFILE_SAVE_FAILED')
      void notifyAdminEvent({
        agent: 'freelancer_profile',
        idempotencyKey: `freelancer_profile:${userId}`,
        entityId: userId,
        title: 'Freelancer profile created',
        lines: [`User: ${userId}`, `Category: ${category}`, `Name: ${displayName}`],
        adminPath: '/admin/samples',
      })
    }

    const id = randomUUID()
    sampleId = id
    const slug = `${slugifySample(title)}-${id.slice(0, 8)}`
    const { error: sampleError } = await admin.from('samples').insert({
      id,
      owner_id: userId,
      title,
      slug,
      category,
      description,
      status: 'draft',
      price_usd: priceUsd,
      turnaround_days: turnaroundDays,
      revision_limit: revisionTerms.value.revisionLimit,
      revision_price_usd: revisionTerms.value.revisionPriceUsd,
      rights_terms_version: SAMPLE_RIGHTS_TERMS_VERSION,
      scope, deliverables, client_requirements: clientRequirements,
      minimum_resale_price_usd: Math.round(minimumResalePrice * 100) / 100,
      sla_response_hours: slaResponseHours, sla_delivery_days: turnaroundDays,
      service_importance: serviceImportance,
    })
    if (sampleError) throw new Error('SAMPLE_CREATE_FAILED')

    const { error: costError } = await admin.from('sample_costs').insert({
      sample_id: id,
      cost_usd: Math.round(costUsd * 100) / 100,
    })
    if (costError) throw new Error('SAMPLE_COST_SAVE_FAILED')
    if (addons.length) {
      const { error: addonError } = await admin.from('sample_addons').insert(addons.map((addon,index) => ({ sample_id:id, name:String(addon.name).trim().slice(0,100), description:String(addon.description||'').trim().slice(0,500), price_usd:Math.round(Number(addon.priceUsd)*100)/100, extra_days:Math.floor(Number(addon.extraDays)||0), sort_order:index })))
      if (addonError) throw new Error('SAMPLE_ADDONS_SAVE_FAILED')
    }

    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      const mime = (file.type || '').toLowerCase()
      const kind = sampleFileKind(mime)
      if (!kind) throw new Error('INVALID_FILE_TYPE')
      const bytes = Buffer.from(await file.arrayBuffer())
      const hash = createHash('sha256').update(bytes).digest('hex')
      const path = `${userId}/${id}/${randomUUID()}-${safeSampleFilename(file.name)}`
      const upload = await admin.storage.from(SAMPLE_ORIGINAL_BUCKET).upload(path, bytes, {
        contentType: mime,
        upsert: false,
      })
      if (upload.error) throw new Error('ORIGINAL_UPLOAD_FAILED')
      uploadedOriginals.push(path)
      const { error: fileError } = await admin.from('sample_files').insert({
        sample_id: id,
        kind,
        storage_path: path,
        mime,
        size_bytes: file.size,
        sha256: hash,
        sort_order: index,
      })
      if (fileError) throw new Error('SAMPLE_FILE_RECORD_FAILED')
    }

    if (cover instanceof File && cover.size > 0) {
      const coverPath = `${userId}/${id}/cover-${safeSampleFilename(cover.name)}`
      const upload = await admin.storage.from(SAMPLE_COVER_BUCKET).upload(coverPath, Buffer.from(await cover.arrayBuffer()), {
        contentType: cover.type,
        upsert: false,
      })
      if (upload.error) throw new Error('COVER_UPLOAD_FAILED')
      uploadedCover = coverPath
      const { error: coverError } = await admin.from('samples').update({ cover_path: coverPath }).eq('id', id).eq('owner_id', userId)
      if (coverError) throw new Error('COVER_SAVE_FAILED')
    }

    const { data: submitted, error: submitError } = await admin
      .from('samples')
      .update({ status: 'pending_review', rights_attested_at: new Date().toISOString(), rights_terms_version: SAMPLE_RIGHTS_TERMS_VERSION })
      .eq('id', id)
      .eq('owner_id', userId)
      .select('id, title, status, created_at, updated_at')
      .single()
    if (submitError || !submitted) throw new Error('SUBMISSION_FAILED')

    try {
      await audit({
        actorId: userId,
        actorEmail: email,
        action: 'sample_submitted',
        entity: 'sample',
        entityId: id,
        newValue: { title, category, fileCount: files.length },
      })
    } catch (auditError) {
      console.error('[samples POST audit]', auditError)
    }

    void runSampleReviewAgent({ sampleId: id, updatedAt: (submitted as { updated_at?: string }).updated_at }).catch(
      (e) => console.error('[samples POST agent]', e),
    )

    return NextResponse.json({ ok: true, sample: submitted }, { status: 201 })
  } catch (e) {
    const code = (e as Error).message
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'FREELANCER_ONLY' || code === 'PROFILE_NOT_FOUND') return NextResponse.json({ error: 'FREELANCER_ONLY' }, { status: 403 })
    if (sampleId) {
      const admin = adminClient()
      await admin.from('samples').delete().eq('id', sampleId)
      if (uploadedOriginals.length) await admin.storage.from(SAMPLE_ORIGINAL_BUCKET).remove(uploadedOriginals)
      if (uploadedCover) await admin.storage.from(SAMPLE_COVER_BUCKET).remove([uploadedCover])
    }
    console.error('[samples POST]', code)
    return NextResponse.json({ error: code || 'SUBMISSION_FAILED' }, { status: 500 })
  }
}

/** PATCH /api/samples — owner updates revision terms while the existing edit window allows it. */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireUser()
    const form = await request.formData()
    const id = String(form.get('id') || '').trim()
    if (!id) return NextResponse.json({ error: 'SAMPLE_REQUIRED' }, { status: 400 })
    const revisionTerms = parseSampleRevisionTerms(form.get('revision_limit'), form.get('revision_price_usd'))
    if (!revisionTerms.value) return NextResponse.json({ error: 'INVALID_REVISION_TERMS', message: revisionTerms.error }, { status: 400 })

    const client = await sessionClient()
    const { data, error } = await client
      .from('samples')
      .update({
        revision_limit: revisionTerms.value.revisionLimit,
        revision_price_usd: revisionTerms.value.revisionPriceUsd,
        status: 'draft',
      })
      .eq('id', id)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle()
    if (error || !data) {
      const locked = /FORBIDDEN|policy|permission/i.test(error?.message || '') || !data
      return NextResponse.json(
        { error: locked ? 'SAMPLE_EDIT_WINDOW_CLOSED' : 'SAMPLE_UPDATE_FAILED' },
        { status: locked ? 409 : 500 },
      )
    }
    return NextResponse.json({
      ok: true,
      sample: {
        id: data.id,
        status: 'draft',
        revision_limit: revisionTerms.value.revisionLimit,
        revision_price_usd: revisionTerms.value.revisionPriceUsd,
      },
    })
  } catch (e) {
    const code = (e as Error).message
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    console.error('[samples PATCH]', code)
    return NextResponse.json({ error: 'SAMPLE_UPDATE_FAILED' }, { status: 500 })
  }
}
