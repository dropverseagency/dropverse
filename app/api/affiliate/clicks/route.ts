import { NextRequest, NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { limitPublicForm, rateLimitResponse } from '@/lib/rateLimit'

/**
 * POST /api/affiliate/clicks — record an anonymous referral click.
 * Runs as the visitor's own session (anon key) so it works for logged-out visitors.
 * Body: { code, landingPath? }
 */
export async function POST(request: NextRequest) {
  const _rl = await limitPublicForm(request)
  if (!_rl.success) return rateLimitResponse(_rl)

  try {
    const body = (await request.json()) as { code?: string; landingPath?: string }
    const code = (body.code ?? '').trim().toUpperCase()
    if (!code) return NextResponse.json({ ok: false, reason: 'NO_CODE' })

    const supabase = await sessionClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: codeRow } = await supabase
      .from('referral_codes')
      .select('id')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle()

    const visitorKey = user ? user.id : null

    await supabase.from('referral_clicks').insert({
      referral_code_id: codeRow?.id ?? null,
      code,
      visitor_key: visitorKey,
      landing_path: body.landingPath ?? request.nextUrl.pathname,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, reason: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
