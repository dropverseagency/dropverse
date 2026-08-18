import { NextRequest } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'
import { createClient } from '@supabase/supabase-js'
import { referralLinkFor } from '@/lib/referralConfig'

/**
 * GET /api/affiliate/me — the current user's affiliate data.
 * Returns only the caller's own codes/referrals/commissions (RLS would also
 * enforce this, but server-side filtering guarantees it regardless of policy).
 * Authenticated users only; admins read only their own data here.
 */
export async function GET(request: NextRequest) {
  // Accept session cookies (browser) or Authorization: Bearer <JWT> (API/E2E).
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  let user = null as any
  if (bearer) {
    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const res = await supa.auth.getUser(bearer)
    user = res.data?.user ?? null
  } else {
    const supabase = await sessionClient()
    const res = await supabase.auth.getUser()
    user = res.data?.user ?? null
  }
  if (!user) return new Response(JSON.stringify({ error: 'NOT_AUTHENTICATED' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  const admin = adminClient()

  // My referral codes (auto-provision one if missing)
  let { data: codes } = await admin
    .from('referral_codes')
    .select('id, code, kind, active, created_at')
    .eq('user_id', user.id)
  if (!codes || codes.length === 0) {
    const code = `DV-${user.id.slice(0, 8).toUpperCase()}`
    const { data } = await admin
      .from('referral_codes')
      .insert({ user_id: user.id, code, kind: 'user' })
      .select()
    codes = data ?? null
  }
  if (!codes || codes.length === 0) {
    return new Response(JSON.stringify({ error: 'NO_CODE' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  const primaryCode = codes[0].code

  // My referrals (as referrer) with their commissions
  const { data: referrals } = await admin
    .from('referrals')
    .select('id, referred_user_id, status, created_at, attributed_at, source_channel')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })

  const referralsWithCommissions = await Promise.all(
    (referrals ?? []).map(async (r: any) => {
      const { data: commissions } = await admin
        .from('referral_commissions')
        .select('id, base_amount, commission_rate, commission_amount, currency, status, created_at, available_at, paid_at')
        .eq('referral_id', r.id)
      const { data: referredProfile } = await admin
        .from('profiles')
        .select('full_name, username')
        .eq('id', r.referred_user_id ?? '')
        .maybeSingle()
      return { ...r, commissions: commissions ?? [], referredProfile }
    }),
  )

  const totals = {
    activeReferrals: referralsWithCommissions.filter((r) => r.status === 'active').length,
    totalCommissions: referralsWithCommissions.reduce((s, r) => s + r.commissions.length, 0),
    pendingAmount: referralsWithCommissions.reduce(
      (s: number, r: { commissions: { status: string; commission_amount: number | null }[] }) =>
        s + r.commissions
          .filter((c: { status: string; commission_amount: number | null }) => c.status === 'pending' || c.status === 'approved')
          .reduce((a: number, c: { commission_amount: number | null }) => a + Number(c.commission_amount || 0), 0),
      0,
    ),
    availableAmount: referralsWithCommissions.reduce(
      (s: number, r: { commissions: { status: string; commission_amount: number | null }[] }) =>
        s + r.commissions
          .filter((c: { status: string; commission_amount: number | null }) => c.status === 'available')
          .reduce((a: number, c: { commission_amount: number | null }) => a + Number(c.commission_amount || 0), 0),
      0,
    ),
    paidAmount: referralsWithCommissions.reduce(
      (s: number, r: { commissions: { status: string; commission_amount: number | null }[] }) =>
        s + r.commissions
          .filter((c: { status: string; commission_amount: number | null }) => c.status === 'paid')
          .reduce((a: number, c: { commission_amount: number | null }) => a + Number(c.commission_amount || 0), 0),
      0,
    ),
  }

  const { data: myReferral } = await admin
    .from('referrals')
    .select('id, status, referral_code_id')
    .eq('referred_user_id', user.id)
    .maybeSingle()

  return new Response(
    JSON.stringify({
      code: primaryCode,
      referralLink: referralLinkFor(primaryCode, request.headers.get('host') ?? undefined),
      referrals: referralsWithCommissions,
      totals,
      referredBy: myReferral ? { referralId: myReferral.id, status: myReferral.status } : null,
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  )
}
