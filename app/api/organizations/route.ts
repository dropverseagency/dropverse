import { NextRequest, NextResponse } from 'next/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '../../../lib/supabaseService'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rateLimit'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Create an organization + owner membership + settings row in one
 * service-role transaction. Client-side direct inserts fail because
 * PostgREST's returning-select is denied by the member-only SELECT policy
 * (the owner isn't a member yet at return time).
 */
export async function POST(req: NextRequest) {
  const _rl = await rateLimit(`org-create:${clientIp(req)}`, { limit: 5, windowMs: 600_000 })
  if (!_rl.success) return rateLimitResponse(_rl)

  const hdrs = await headers()
  const bearer = (hdrs.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  let user = null as any
  if (bearer) {
    const supa = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data } = await supa.auth.getUser(bearer)
    user = data.user
  }
  if (!user) {
    const cookieStore = await cookies()
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      },
    )
    const { data } = await ssr.auth.getUser()
    user = data.user
  }
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 120)
  if (!name) return NextResponse.json({ error: 'NAME_REQUIRED' }, { status: 400 })

  const admin = createServiceClient()
  const base = slugify(name) || 'org'
  let slug = base
  for (let i = 0; i < 8; i++) {
    const { data: exists } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
    if (!exists) break
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ name, slug, owner_id: user.id })
    .select('*')
    .single()
  if (orgErr || !org) {
    return NextResponse.json({ error: orgErr?.message || 'CREATE_FAILED' }, { status: 500 })
  }

  await admin.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'owner',
  })

  return NextResponse.json({ organization: org })
}

export async function GET() {
  const cookieStore = await cookies()
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
  const {
    data: { user },
  } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const admin = createServiceClient()
  const { data: memberships } = await admin
    .from('organization_members')
    .select('organization_id, role, organizations(*)')
    .eq('user_id', user.id)
  return NextResponse.json({ memberships: memberships || [] })
}
