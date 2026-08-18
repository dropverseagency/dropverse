import { NextRequest, NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'

/**
 * POST /api/affiliate/clicks — record an anonymous referral click.
 * Runs as the visitor's own session (anon key) so it works for logged-out visitors.
 * Body: { code, landingPath? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: string; landingPath?: string }
    const code = (body.code ?? '').trim().toUpperCase()
    if (!code) return NextResponse.json({ ok: false, reason: 'NO_CODE' })

    const supabase = await sessionClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Find the code row id if it exists (anonymous users can only select active codes via RLS)
    const { data: codeRow } = await supabase
      .from('referral_codes')
      .select('id')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle()

    const visitorKey = user ? user.id : null // logged-in visitors use uid; guests stay anonymous

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
