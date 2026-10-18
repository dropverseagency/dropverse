import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
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

function buildPreviewMeta(fileName: string, bytes: number, contentType: string): Record<string, unknown> {
  return {
    fileName: fileName.slice(0, 120),
    bytes,
    contentType,
    note: 'Full lead rows are available only after purchase. Preview is metadata only.',
  }
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
    const maxBuyers = Math.max(1, parseInt(String(form.get('max_buyers') || LEAD_DEFAULT_MAX_BUYERS), 10) || LEAD_DEFAULT_MAX_BUYERS)
    const sourceAttestation = String(form.get('source_attestation') || '').trim()
    const resaleAck = String(form.get('resale_rights_ack') || '') === 'true'
    const file = form.get('file')

    if (title.length < 3 || title.length > 120) {
      return NextResponse.json({ error: 'INVALID_TITLE' }, { status: 400 })
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
    const extOk = nameLower.endsWith('.csv') || nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')
    if (!LEAD_ALLOWED_MIME.has(mime) && !extOk) {
      return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })
    }

    const countries = countriesRaw
      ? countriesRaw.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 30)
      : []

    const bytes = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const admin = adminClient()

    await ensurePrivateBucket(admin)

    const packId = crypto.randomUUID()
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

    const preview_meta = buildPreviewMeta(file.name || safeName, file.size, mime)

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
      .select(
        'id, title, status, price_usd, max_buyers, created_at',
      )
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
      newValue: { title, price_usd: priceUsd, max_buyers: maxBuyers, ip: clientIp(request) },
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
