import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { adminClient, audit } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'
import {
  LEAD_ALLOWED_MIME,
  LEAD_DEFAULT_MAX_BUYERS,
  LEAD_MAX_FILE_BYTES,
} from '@/lib/leads/types'
import { limitPublicForm, rateLimitResponse, clientIp } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const BUCKET = 'lead-packs'

async function ensurePrivateBucket(admin: ReturnType<typeof adminClient>) {
  const existing = await admin.storage.getBucket(BUCKET)
  if (!existing.error) return
  const created = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: LEAD_MAX_FILE_BYTES,
  })
  if (created.error) throw new Error(created.error.message)
}

function buildPreviewMeta(fileName: string, bytes: number, contentType: string, quality: Record<string, unknown>): Record<string, unknown> {
  return {
    fileName: fileName.slice(0, 120),
    bytes,
    contentType,
    note: 'Full lead rows are available only after purchase. Preview is metadata only.',
    ...quality,
  }
}

function scoreLeadPack(input: { serviceTarget: string; niche: string; evidence: string; verificationLevel: string; dataAsOf: string; duplicatesRemoved: boolean; description: string; countries: string[]; sourceAttestation: string }): number {
  let score = input.serviceTarget && input.niche.trim().length >= 3 ? 25 : 0
  score += input.evidence.trim().length >= 50 ? 25 : input.evidence.trim().length >= 30 ? 15 : 0
  score += input.verificationLevel === 'verified' ? 20 : input.verificationLevel === 'partial' ? 12 : 5
  const ageDays = Math.floor((Date.now() - new Date(`${input.dataAsOf}T00:00:00Z`).getTime()) / 86400000)
  score += ageDays <= 90 ? 10 : ageDays <= 180 ? 7 : 3
  score += input.duplicatesRemoved ? 10 : 0
  score += input.description.trim().length >= 20 && input.countries.length > 0 && input.sourceAttestation.trim().length >= 10 ? 10 : 0
  return Math.max(0, Math.min(100, score))
}

/** GET /api/leads/packs — seller's own packs */
export async function GET() {
  try {
    const { userId } = await requireUser()
    const admin = adminClient()
    const { data, error } = await admin
      .from('lead_packs')
      .select(
        'id, title, description, niche, countries, price_usd, currency, max_buyers, admin_max_buyers, sold_count, status, preview_meta, reject_reason, created_at, updated_at',
      )
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'LIST_FAILED' }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}

/** POST /api/leads/packs — multipart upload → pending_review */
export async function POST(request: NextRequest) {
  try {
    const rl = await limitPublicForm(request)
    if (!rl.success) return rateLimitResponse(rl, 'Too many uploads. Please wait and try again.')

    const { userId, email } = await requireUser()
    const form = await request.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 })

    const title = String(form.get('title') || '').trim()
    const description = String(form.get('description') || '').trim()
    const niche = String(form.get('niche') || '').trim()
    const countriesRaw = String(form.get('countries') || '').trim()
    const priceUsd = Number(form.get('price_usd') || 0)
    const maxBuyers = Math.max(
      1,
      parseInt(String(form.get('max_buyers') || LEAD_DEFAULT_MAX_BUYERS), 10) || LEAD_DEFAULT_MAX_BUYERS,
    )
    const sourceAttestation = String(form.get('source_attestation') || '').trim()
    const serviceTarget = String(form.get('service_target') || '').trim()
    const audienceType = String(form.get('audience_type') || '').trim()
    const needEvidence = String(form.get('need_evidence') || '').trim()
    const dataAsOf = String(form.get('data_as_of') || '').trim()
    const recordCount = Number(form.get('record_count') || 0)
    const verificationLevel = String(form.get('verification_level') || '').trim()
    const duplicatesRemoved = String(form.get('duplicates_removed') || '') === 'true'
    const qualityPolicyAck = String(form.get('quality_policy_ack') || '') === 'true'
    const resaleAck = String(form.get('resale_rights_ack') || '') === 'true'
    const file = form.get('file')

    if (title.length < 3 || title.length > 120) {
      return NextResponse.json({ error: 'INVALID_TITLE' }, { status: 400 })
    }
    if (description.length < 20 || niche.length < 3 || countriesRaw.length < 2) {
      return NextResponse.json({ error: 'TARGETED_LIST_DETAILS_REQUIRED', message: 'Add a clear description, specific niche, and target country.' }, { status: 400 })
    }
    if (!serviceTarget || !['freelancers_and_agencies', 'freelancers', 'agencies'].includes(audienceType)) {
      return NextResponse.json({ error: 'SERVICE_AND_AUDIENCE_REQUIRED' }, { status: 400 })
    }
    if (needEvidence.length < 30) {
      return NextResponse.json({ error: 'NEED_EVIDENCE_REQUIRED', message: 'Explain why the leads may need this service (at least 30 characters).' }, { status: 400 })
    }
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dataAsOf) || Number.isNaN(new Date(`${dataAsOf}T00:00:00Z`).getTime()) || new Date(`${dataAsOf}T00:00:00Z`).getTime() > Date.now()) {
      return NextResponse.json({ error: 'INVALID_DATA_DATE' }, { status: 400 })
    }
    if (!Number.isInteger(recordCount) || recordCount < 1 || recordCount > 1000000) {
      return NextResponse.json({ error: 'INVALID_RECORD_COUNT' }, { status: 400 })
    }
    if (!['verified', 'partial', 'unverified'].includes(verificationLevel)) {
      return NextResponse.json({ error: 'INVALID_VERIFICATION_LEVEL' }, { status: 400 })
    }
    if (!duplicatesRemoved || !qualityPolicyAck) {
      return NextResponse.json({ error: 'QUALITY_POLICY_ACK_REQUIRED', message: 'Confirm the list is targeted, duplicates were checked, and claims are accurate.' }, { status: 400 })
    }
    if (!(priceUsd > 0)) {
      return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 })
    }
    if (!resaleAck) {
      return NextResponse.json({ error: 'RESALE_ACK_REQUIRED' }, { status: 400 })
    }
    if (!sourceAttestation || sourceAttestation.length < 10) {
      return NextResponse.json({ error: 'SOURCE_ATTESTATION_REQUIRED' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > LEAD_MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })
    }
    const mime = (file.type || 'application/octet-stream').toLowerCase()
    const nameLower = (file.name || '').toLowerCase()
    const extOk =
      nameLower.endsWith('.csv') || nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')
    if (!LEAD_ALLOWED_MIME.has(mime) && !extOk) {
      return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })
    }

    const countries = countriesRaw
      ? countriesRaw
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 30)
      : []

    if (!countriesRaw.split(',').map((c) => c.trim()).filter(Boolean).length) {
      return NextResponse.json({ error: 'TARGET_COUNTRY_REQUIRED' }, { status: 400 })
    }

    const countries = countriesRaw
      ? countriesRaw.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 30)
      : []
    const qualityScore = scoreLeadPack({ serviceTarget, niche, evidence: needEvidence, verificationLevel, dataAsOf, duplicatesRemoved, description, countries, sourceAttestation })

    const bytes = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const admin = adminClient()

    await ensurePrivateBucket(admin)

    const packId = randomUUID()
    const safeName = (file.name || 'leads.csv').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
    const storagePath = `packs/${userId}/${packId}/${sha256}-${safeName}`

    const uploaded = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: mime,
      upsert: false,
    })
    if (uploaded.error) {
      console.error('[leads] upload', uploaded.error.message)
      return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
    }

    const preview_meta = buildPreviewMeta(file.name || safeName, file.size, mime, {
      serviceTarget,
      audienceType,
      needEvidence,
      dataAsOf,
      recordCount,
      verificationLevel,
      duplicatesRemoved,
      qualityPolicyAck,
      qualityScore,
      qualityBand: qualityScore >= 80 ? 'eligible_for_review' : qualityScore >= 65 ? 'manual_review_required' : 'below_minimum',
    })

    const { data: pack, error: insertError } = await admin
      .from('lead_packs')
      .insert({
        id: packId,
        seller_id: userId,
        title,
        description,
        niche,
        countries,
        price_usd: Math.round(priceUsd * 100) / 100,
        max_buyers: maxBuyers,
        status: 'pending_review',
        preview_meta,
        source_attestation: sourceAttestation,
        resale_rights_ack: true,
        storage_path: storagePath,
        file_sha256: sha256,
        file_bytes: file.size,
        file_content_type: mime,
      })
      .select('id, title, status, price_usd, max_buyers, created_at')
      .single()

    if (insertError || !pack) {
      console.error('[leads] insert pack', insertError?.message)
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 })
    }

    await audit({
      actorId: userId,
      actorEmail: email,
      action: 'lead_pack_submitted',
      entity: 'lead_pack',
      entityId: packId,
      newValue: { title, price_usd: priceUsd, max_buyers: maxBuyers, serviceTarget, countries, recordCount, qualityScore, ip: clientIp(request) },
    })

    return NextResponse.json({ ok: true, pack })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('[leads] packs POST', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
