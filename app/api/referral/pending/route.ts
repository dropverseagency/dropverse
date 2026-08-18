import { NextRequest, NextResponse } from 'next/server'

const PENDING_COOKIE = 'dv_referral_code'

/**
 * GET  /api/referral/pending?code=CODE  — mark a referral code as pending for signup.
 * POST /api/referral/pending             — read & consume the pending code cookie.
 * Used by the /r/[code] landing route and the signup flow to attribute referrals
 * at account creation time.
 */
export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'NO_CODE' })

  const response = NextResponse.json({ ok: true })
  response.cookies.set(PENDING_COOKIE, code, {
    maxAge: 60 * 60 * 24 * 30, // 30 days — covers the attribution window
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // browser script reads it to confirm to the user
  })
  return response
}

export async function POST(request: NextRequest) {
  const pending = request.cookies.get(PENDING_COOKIE)?.value
  return NextResponse.json({ code: pending ?? null })
}
