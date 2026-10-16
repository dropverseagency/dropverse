/**
 * Authenticated upload for agency landing assets (logo).
 * Auth + plan gate via requireAgencyLandingAccess.
 * Images only, max 5MB. Public bucket agency-assets.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireAgencyLandingAccess } from '../../../../lib/agency/landing'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
const MAX_BYTES = 5 * 1024 * 1024

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function sessionClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  )
}

export async function POST(request: NextRequest) {
  const supabase = await sessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 })

  const orgId = String(form.get('organizationId') || '').trim()
  const file = form.get('file')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })
  }
  const type = (file.type || '').toLowerCase()
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })
  }

  const access = await requireAgencyLandingAccess(supabase, user.id, orgId)
  if (!access.ok) {
    const status = access.error === 'PLAN_REQUIRED' ? 402 : 403
    return NextResponse.json({ error: access.error }, { status })
  }

  const db = admin()
  const bucket = 'agency-assets'
  const existing = await db.storage.getBucket(bucket)
  if (existing.error) {
    const created = await db.storage.createBucket(bucket, { public: true })
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 })
  }

  const ext = type === 'image/svg+xml' ? 'svg' : type.split('/')[1] || 'bin'
  const safeBase = (file.name || 'logo').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
  const path = `logos/${orgId}/${Date.now()}-${safeBase}.${ext}`

  const bytes = Buffer.from(await file.arrayBuffer())
  const uploaded = await db.storage.from(bucket).upload(path, bytes, {
    contentType: type,
    upsert: false,
  })
  if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 })

  const { data } = db.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ ok: true, url: data.publicUrl })
}
