import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { adminClient, audit, sessionClient } from '@/lib/adminCore'
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

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CONFLICT_PREFIXES = [
  'SUBMIT_REQUIRES_FILE',
  'SUBMIT_REQUIRES_COST',
  'SUBMIT_REQUIRES_PROFILE',
  'MAX_ACTIVE_SAMPLES',
  'MAX_FILES',
  'MAX_LINKS',
  'FORBIDDEN',
] as const

function samplesSessionWritesEnabled(): boolean {
  return process.env.SAMPLES_SESSION_WRITES === 'true'
}

function isUuidV4(value: string): boolean {
  return UUID_V4_RE.test(value)
}

function mapSampleWriteError(raw: string): { status: number; error: string } {
  const message = (raw || '').trim()
  if (!message) return { status: 500, error: 'SUBMISSION_FAILED' }
  if (message === 'NOT_AUTHENTICATED') return { status: 401, error: message }
  if (message === 'FREELANCER_ONLY' || message === 'PROFILE_NOT_FOUND') {
    return { status: 403, error: 'FREELANCER_ONLY' }
  }
  if (message === 'OWNER_MISMATCH') return { status: 403, error: 'OWNER_MISMATCH' }
  if (message === 'SAMPLE_ID_CONFLICT') return { status: 409, error: 'SAMPLE_ID_CONFLICT' }
  if (message === 'INVALID_CLIENT_SAMPLE_ID') {
    return { status: 400, error: 'INVALID_CLIENT_SAMPLE_ID' }
  }
  for (const prefix of CONFLICT_PREFIXES) {
    if (message === prefix || message.startsWith(prefix)) {
      return { status: 409, error: message }
    }
  }
  const upper = message.toUpperCase()
  for (const prefix of CONFLICT_PREFIXES) {
    if (upper.includes(prefix)) {
      const idx = message.indexOf(prefix)
      const extracted = idx >= 0 ? message.slice(idx) : message
      return { status: 409, error: extracted }
    }
  }
  return { status: 500, error: 'SUBMISSION_FAILED' }
}

async function getOwnerDbClient(request: NextRequest): Promise<{
  client: SupabaseClient
  userId: string
  email: string | null
}> {
  const authHeader = request.headers.get('authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (bearer) {
    const probe = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data, error } = await probe.auth.getUser(bearer)
    if (error || !data.user) throw new Error('NOT_AUTHENTICATED')
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      },
    )
    return { client, userId: data.user.id, email: data.user.email ?? null }
  }
  const client = await sessionClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('NOT_AUTHENTICATED')
  return { client, userId: data.user.id, email: data.user.email ?? null }
}

function dbErrorMessage(error: { message?: string; code?: string } | null): string {
  return (error?.message || '').trim() || 'SUBMISSION_FAILED'
}

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
      return NextResponse.json({ items: (data ?? []).map((item) => publicSample(item)) })
    }

    const { data, error } = await admin
      .from('samples_public')
      .select('id, title, slug, category, description, price_usd, turnaround_days, cover_path, created_at, freelancer_display_name, freelancer_category')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ items: (data ?? []).map((item) => publicSample(item, true)) })
  } catch (e) {
    const code = (e as Error).message
    if (code === 'NOT_AUTHENTICATED') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'FREELANCER_ONLY') return NextResponse.json({ error: code }, { status: 403 })
    if (code === 'PROFILE_NOT_FOUND') return NextResponse.json({ error: code }, { status: 403 })
    console.error('[samples GET]', code)
    return NextResponse.json({ error: 'SAMPLES_UNAVAILABLE' }, { status: 503 })
  }
}
