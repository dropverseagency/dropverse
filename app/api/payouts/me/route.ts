import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminClient, sessionClient } from '@/lib/adminCore'
import {
  DROPVERSE_PAYOUT_FEE_USD,
  PAYOUT_CURRENCY,
  PAYOUT_METHODS,
  PAYOUT_SCHEDULE_DAYS,
  nextScheduledProcessingDate,
} from '@/lib/payoutConfig'

async function resolveUser(request: NextRequest) {
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\\s+/i, '').trim()
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

function jsonError(error: string, status = 500) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 * GET /api/payouts/me
 * Returns only the authenticated user's balances, breakdown, and payout history.
 * Any failed ledger read fails closed instead of being treated as an empty ledger.
 */
export async function GET(request: NextRequest) {
  const user = await resolveUser(request)
  if (!user) return jsonError('NOT_AUTHENTICATED', 401)

  const admin = adminClient()
  const { data: referralRows, error: referralsError } = await admin
    .from('referrals')
    .select('id')
    .eq('referrer_id', user.id)

  if (referralsError || !referralRows) {
    console.error('[payouts/me] referral lookup failed', referralsError)
    return jsonError('PAYOUT_DATA_UNAVAILABLE')
  }

  const referralIds = referralRows.map((r: { id: string }) => r.id)
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
    const { data, error } = await admin
      .from('referral_commissions')
      .select('id, commission_amount, status, currency, created_at, available_at, paid_at')
      .in('referral_id', referralIds)

    if (error || !data) {
      console.error('[payouts/me] commission lookup failed', error)
      return jsonError('PAYOUT_DATA_UNAVAILABLE')
    }
    commissions = data
  }

  // Do not mix currencies in a USD payout balance.
  const nonUsdCommission = commissions.some((c) => (c.currency ?? 'USD').toUpperCase() !== 'USD')
  if (nonUsdCommission) {
    console.error('[payouts/me] non-USD commission found for USD payout ledger', { userId: user.id })
    return jsonError('PAYOUT_DATA_UNAVAILABLE')
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

  const { data: payouts, error: payoutsError } = await admin
    .from('payout_requests')
    .select('id, amount, status, method, dropverse_fee, estimated_net, requested_at, reviewed_at, paid_at')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false })
    .limit(100)

  if (payoutsError || !payouts) {
    console.error('[payouts/me] payout history lookup failed', payoutsError)
    return jsonError('PAYOUT_DATA_UNAVAILABLE')
  }

  const openPayouts = payouts.filter((p) => p.status === 'pending' || p.status === 'approved')
  const processingBalance = Math.round(
    openPayouts.reduce((s, p) => s + Number(p.amount || 0), 0) * 100,
  ) / 100
  const totalPaidPayouts = Math.round(
    payouts
      .filter((p) => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount || 0), 0) * 100,
  ) / 100

  const availableBalance = Math.max(0, Math.round((availableCommissions - processingBalance) * 100) / 100)

  const history = payouts.map((p) => ({
    id: p.id,
    requestedAt: p.requested_at,
    amount: Number(p.amount || 0),
    currency: PAYOUT_CURRENCY,
    // Existing requests predate these persisted terms; don't invent historical fees.
    dropverseFee: p.dropverse_fee == null ? null : Number(p.dropverse_fee),
    providerFee: null as number | null,
    estimatedNet: p.estimated_net == null ? null : Number(p.estimated_net),
    method: p.method ?? null,
    status: p.status,
    reviewedAt: p.reviewed_at,
    paidAt: p.paid_at,
    failureReason: null as string | null,
  }))

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
