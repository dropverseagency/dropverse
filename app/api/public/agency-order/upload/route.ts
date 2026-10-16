/**
 * Public upload for agency landing order brief files.
 * Rate-limited. Allows common image/doc types. Max 10MB, max 5 files client-side.
 * Files land in public bucket agency-order-files under order-drafts/.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'video/mp4',
  'video/quicktime',
])
const MAX_BYTES = 10 * 1024 * 1024

const hits = new Map<string, { count: number; resetAt: number }>()
function rateLimit(key: string): boolean {
  const now = Date.now()
  const row = hits.get(key)
  if (!row || now > row.resetAt) {
    hits.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (row.count >= 20) return false
  row.count += 1
  return true
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  if (!rateLimit(`agency-file:${ip}`)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 })

  const slug = String(form.get('slug') || '')
    .trim()
    .toLowerCase()
  const file = form.get('file')
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'INVALID_SLUG' }, { status: 400 })
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })
  }
  const type = (file.type || '').toLowerCase() || 'application/octet-stream'
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })
  }

  const db = admin()
  // Ensure page is published (do not accept uploads for random slugs)
  const { data: page } = await db
    .from('agency_landing_pages')
    .select('id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  if (!page) return NextResponse.json({ error: 'PAGE_NOT_FOUND' }, { status: 404 })

  const bucket = 'agency-order-files'
  const existing = await db.storage.getBucket(bucket)
  if (existing.error) {
    const created = await db.storage.createBucket(bucket, { public: true })
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 })
  }

  const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
  const path = `briefs/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const uploaded = await db.storage.from(bucket).upload(path, bytes, {
    contentType: type,
    upsert: false,
  })
  if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 })

  const { data } = db.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({
    ok: true,
    url: data.publicUrl,
    name: file.name,
    size: file.size,
    contentType: type,
  })
}
