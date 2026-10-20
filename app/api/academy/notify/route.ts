import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminClient, sessionClient } from '@/lib/adminCore'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (e.length < 3 || e.length > 320) return null
  if (!EMAIL_RE.test(e)) return null
  return e
}

/**
 * POST /api/academy/notify
 * Body: { email?: string }
 * Saves interest in Advanced Academy. Uses session email when signed in if body empty.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  let user: { id: string; email?: string | null } | null = null
  if (bearer) {
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const res = await supa.auth.getUser(bearer)
    user = res.data?.user ?? null
  } else {
    try {
      const supabase = await sessionClient()
      const res = await supabase.auth.getUser()
      user = res.data?.user ?? null
    } catch {
      user = null
    }
  }

  const email = normalizeEmail(body.email) || normalizeEmail(user?.email ?? null)
  if (!email) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: existing } = await admin
    .from('academy_waitlist')
    .select('id, email, created_at')
    .eq('email', email)
    .eq('source', 'academy_advanced')
    .maybeSingle()

  if (existing) {
    if (user?.id) {
      await admin
        .from('academy_waitlist')
        .update({ user_id: user.id })
        .eq('id', existing.id)
        .is('user_id', null)
    }
    return NextResponse.json({
      ok: true,
      already: true,
      email: existing.email,
      message: 'You are already on the list.',
    })
  }

  const ins = await admin
    .from('academy_waitlist')
    .insert({
      email,
      user_id: user?.id ?? null,
      source: 'academy_advanced',
    })
    .select('id, email, created_at')
    .single()

  if (ins.error) {
    if (String(ins.error.code) === '23505' || /duplicate|unique/i.test(ins.error.message || '')) {
      return NextResponse.json({
        ok: true,
        already: true,
        email,
        message: 'You are already on the list.',
      })
    }
    console.error('[academy/notify]', ins.error)
    return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    already: false,
    email: ins.data.email,
    message: 'We will email you when Advanced Academy opens.',
  })
}
