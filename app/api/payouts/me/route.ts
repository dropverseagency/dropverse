import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminClient, sessionClient } from '@/lib/adminCore'
import {
  DROPVERSE_PAYOUT_FEE_USD,
  PAYOUT_CURRENCY,
  PAYOUT_METHODS,
  PAYOUT_SCHEDULE_DAYS,
  estimateNetUsd,
  nextScheduledProcessingDate,
} from '@/lib/payoutConfig'

async function resolveUser(request: NextRequest) {
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (bearer) {
    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const res = await supa.auth.getUser(bearer)
    return res.data?.user ?? null
  }
  const supabase = await sessionClient()
  const res = await supabase.auth.getUser()
  return res.data?.user ?? null
}

/**
 * GET /api/payouts/me
 * Returns only the authenticated user's balances, breakdown, and payout history.
 * Balances are computed server-side from referral_commissions + payout_requests.
 */
export async function GET(request: NextRequest) {
  const user = await resolveUser(request)
  if (!user) {
    return new Response(JSON.stringify({ error: 'NOT_AUTHENTICATED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = adminClient()

  const { data: referralRows } = await admin
    .from('referrals')
    .select('id')
    .eq('referrer_id', user.id)

  const referralIds = (referralRows ?? []).map((r: { id: string }) => r.id)

  let commissions: {
    id: string
    commission_amount: number | null
    status: string
    currency: string | null
    created_at: string
    available_at: string | null
    paid_at: string | null
  }[] = []

  if (referralIds.length > 0) {
    const { data } = await admin
      .from('referral_commissions')
      .select('id, commission_amount, status, currency, created_at, available_at, paid_at')
      .in('referral_id', referralIds)
    commissions = data ?? []
  }

  const sum = (status: string | string[]) => {
    const set = new Set(Array.isArray(status) ? status : [status])
    return commissions
      .filter((c) => set.has(c.status))
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0)
  }

  const pendingBalance = Math.round(sum(['pending', 'approved']) * 100) / 100
  const availableCommissions = Math.round(sum('available') * 100) / 100
  const paidFromCommissions = Math.round(sum('paid') * 100) / 100

  const { data: payouts } = await admin
    .from('payout_requests')
    .select('id, amount, status, requested_at, reviewed_at, paid_at')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false })
    .limit(100)

  const openPayouts = (payouts ?? []).filter((p) => p.status === 'pending' || p.status === 'approved')
  const processingBalance = Math.round(
    openPayouts.reduce((s, p) => s + Number(p.amount || 0), 0) * 100,
  ) / 100
  const totalPaidPayouts = Math.round(
    (payouts ?? [])
      .filter((p) => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount || 0), 0) * 100,
  ) / 100

  // Available to request = available commissions minus open (unpaid) payout requests.
  const availableBalance = Math.max(0, Math.round((availableCommissions - processingBalance) * 100) / 100)

  const history = (payouts ?? []).map((p) => {
    const gross = Number(p.amount || 0)
    const est = estimateNetUsd(gross)
    return {
      id: p.id,
      requestedAt: p.requested_at,
      amount: gross,
      currency: PAYOUT_CURRENCY,
      dropverseFee: DROPVERSE_PAYOUT_FEE_USD,
      providerFee: null as number | null,
      estimatedNet: est.estimatedNet,
      method: null as string | null,
      status: p.status,
      reviewedAt: p.reviewed_at,
      paidAt: p.paid_at,
      failureReason: null as string | null,
    }
  })

  const nextProcessing = nextScheduledProcessingDate()

  return new Response(
    JSON.stringify({
      currency: PAYOUT_CURRENCY,
      balances: {
        pending: pendingBalance,
        available: availableBalance,
        processing: processingBalance,
        totalPaid: totalPaidPayouts,
      },
      breakdown: {
        affiliate: {
          label: 'Affiliate / referral commissions',
          pending: pendingBalance,
          available: availableCommissions,
          paid: paidFromCommissions,
        },
        // Lead marketplace seller settlements and freelancer payouts are not
        // yet tracked in a withdrawable ledger — omit fabricated zeros as sources.
        sourcesNote:
          'Only approved affiliate commissions that have reached available status can be withdrawn. Lead Marketplace and project fulfillment earnings are not yet connected to this ledger.',
      },
      policy: {
        dropverseFeeUsd: DROPVERSE_PAYOUT_FEE_USD,
        scheduleDays: [...PAYOUT_SCHEDULE_DAYS],
        nextScheduledProcessingDate: nextProcessing.toISOString().slice(0, 10),
        scheduleNote:
          'Processing runs on the 5th and 20th of each month. If a date falls on a non-business day or the provider is unavailable, processing may move to the next applicable business day. These are scheduled processing dates, not guaranteed arrival dates.',
        withdrawalsEnabled: true,
        transfersActivated: false,
        transfersNote:
          'Requests are recorded for admin review. Automatic provider transfers are not activated yet — status stays pending until operations processes the payout.',
      },
      methods: PAYOUT_METHODS.map((m) => ({
        id: m.id,
        label: m.label,
        minUsd: m.minUsd,
        enabled: m.enabled,
        description: m.description,
      })),
      history,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  )
}
