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

  const { data: summary, error: summaryError } = await admin.rpc('get_payout_balance_summary', {
    p_user_id: user.id,
  })
  if (summaryError || !summary || typeof summary !== 'object') {
    console.error('[payouts/me] balance summary failed', summaryError)
    return jsonError('PAYOUT_DATA_UNAVAILABLE')
  }

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

  const pendingBalance = Number(summary.pending ?? 0)
  const availableCommissions = Number(summary.availableCommissions ?? 0)
  const paidFromCommissions = Number(summary.paidCommissions ?? 0)
  const processingBalance = Number(summary.processing ?? 0)
  const availableBalance = Number(summary.available ?? 0)
  const totalPaidPayouts = Number(summary.totalPaidPayouts ?? 0)

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
        withdrawalsEnabled: PAYOUT_METHODS.some((m) => m.enabled),
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
