import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { adminClient, audit } from '@/lib/adminCore'
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
} from '@/lib/samples'
import { limitPublicForm, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'

function publicSample(item: Record<string, any>) {
  const coverPath = item.cover_path as string | null
  const { data } = coverPath
    ? adminClient().storage.from(SAMPLE_COVER_BUCKET).getPublicUrl(coverPath)
    : { data: { publicUrl: null } }
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
  const admin = adminClient()
  try {
    if (mine) {
      const { userId } = await requireUser()
      await getProfile(userId)
      const { data, error } = await admin
        .from('samples')
        .select('id, title, slug, category, description, status, price_usd, turnaround_days, rejection_reason, cover_path, created_at, updated_at, sample_costs(cost_usd), sample_files(id, kind, mime, size_bytes)')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ items: (data ?? []).map(publicSample) })
    }

    const { data, error } = await admin
      .from('samples_public')
      .select('id, title, slug, category, description, price_usd, turnaround_days, cover_path, created_at, freelancer_display_name, freelancer_category')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ items: (data ?? []).map(publicSample) })
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
    const rightsConfirmed = form.get('rights_confirmed') === 'true'
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    const cover = form.get('cover')

    if (title.length < 3 || title.length > 120) return NextResponse.json({ error: 'INVALID_TITLE' }, { status: 400 })
    if (description.length > 1000) return NextResponse.json({ error: 'DESCRIPTION_TOO_LONG' }, { status: 400 })
    if (!(SAMPLE_CATEGORIES as readonly string[]).includes(category)) return NextResponse.json({ error: 'INVALID_CATEGORY' }, { status: 400 })
    if (!Number.isInteger(turnaroundDays) || turnaroundDays < 1 || turnaroundDays > 30) return NextResponse.json({ error: 'INVALID_TURNAROUND' }, { status: 400 })
    if (priceUsd !== null && (!Number.isFinite(priceUsd) || priceUsd < 0 || priceUsd > 1000000)) return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 })
    if (!Number.isFinite(costUsd) || costUsd < 1 || costUsd > 5000) return NextResponse.json({ error: 'INVALID_COST' }, { status: 400 })
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
      rights_terms_version: SAMPLE_RIGHTS_TERMS_VERSION,
    })
    if (sampleError) throw new Error('SAMPLE_CREATE_FAILED')

    const { error: costError } = await admin.from('sample_costs').insert({
      sample_id: id,
      cost_usd: Math.round(costUsd * 100) / 100,
    })
    if (costError) throw new Error('SAMPLE_COST_SAVE_FAILED')

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
      .select('id, title, status, created_at')
      .single()
    if (submitError || !submitted) throw new Error('SUBMISSION_FAILED')

    await audit({
      actorId: userId,
      actorEmail: email,
      action: 'sample_submitted',
      entity: 'sample',
      entityId: id,
      newValue: { title, category, fileCount: files.length },
    })
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
