import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminClient, audit, sessionClient } from '@/lib/adminCore'
import {
  DROPVERSE_PAYOUT_FEE_USD,
  estimateNetUsd,
  methodById,
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

async function availableBalanceFor(userId: string): Promise<number> {
  const admin = adminClient()
  const { data: referralRows } = await admin.from('referrals').select('id').eq('referrer_id', userId)
  const referralIds = (referralRows ?? []).map((r: { id: string }) => r.id)
  let availableCommissions = 0
  if (referralIds.length > 0) {
    const { data: commissions } = await admin
      .from('referral_commissions')
      .select('commission_amount, status')
      .in('referral_id', referralIds)
      .eq('status', 'available')
    availableCommissions = (commissions ?? []).reduce((s, c) => s + Number(c.commission_amount || 0), 0)
  }
  const { data: open } = await admin
    .from('payout_requests')
    .select('amount, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved'])
  const reserved = (open ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
  return Math.max(0, Math.round((availableCommissions - reserved) * 100) / 100)
}

/**
 * POST /api/payouts/request
 * Body: { amount: number, method: 'paypal' | 'local', destination?: string }
 *
 * Creates a pending payout_requests row only. Does NOT call any payment provider.
 * Server recalculates available balance; never trusts client balances.
 */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request)
  if (!user) {
    return new Response(JSON.stringify({ error: 'NOT_AUTHENTICATED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { amount?: unknown; method?: unknown; destination?: unknown; idempotencyKey?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const method = methodById(typeof body.method === 'string' ? body.method : '')
  if (!method) {
    return new Response(JSON.stringify({ error: 'INVALID_METHOD' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!method.enabled) {
    return new Response(JSON.stringify({ error: 'METHOD_UNAVAILABLE', message: `${method.label} is not available yet.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const amount = Math.round(Number(body.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: 'INVALID_AMOUNT' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (amount < method.minUsd) {
    return new Response(
      JSON.stringify({
        error: 'BELOW_MINIMUM',
        message: `Minimum for ${method.label} is $${method.minUsd}.`,
        minUsd: method.minUsd,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const available = await availableBalanceFor(user.id)
  if (amount > available) {
    return new Response(
      JSON.stringify({
        error: 'INSUFFICIENT_BALANCE',
        message: 'Requested amount exceeds your available balance.',
        available,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const est = estimateNetUsd(amount)
  if (est.estimatedNet <= 0) {
    return new Response(
      JSON.stringify({
        error: 'AMOUNT_TOO_LOW_FOR_FEE',
        message: `After the $${DROPVERSE_PAYOUT_FEE_USD} DropVerse fee, net would not be positive.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Lightweight idempotency: reject if identical pending amount was created in the last 2 minutes.
  const admin = adminClient()
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: recent } = await admin
    .from('payout_requests')
    .select('id, amount, status, requested_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .eq('amount', amount)
    .gte('requested_at', since)
    .limit(1)
    .maybeSingle()

  if (recent) {
    return new Response(
      JSON.stringify({
        ok: true,
        duplicate: true,
        request: {
          id: recent.id,
          amount: Number(recent.amount),
          status: recent.status,
          requestedAt: recent.requested_at,
        },
        fee: est,
        nextScheduledProcessingDate: nextScheduledProcessingDate().toISOString().slice(0, 10),
        message: 'A matching pending request already exists.',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const destination =
    typeof body.destination === 'string' ? body.destination.trim().slice(0, 200) : ''

  const { data: inserted, error } = await admin
    .from('payout_requests')
    .insert({
      user_id: user.id,
      amount,
      status: 'pending',
    })
    .select('id, amount, status, requested_at')
    .single()

  if (error || !inserted) {
    console.error('[payouts/request]', error)
    return new Response(JSON.stringify({ error: 'SAVE_FAILED' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'payout_requested',
    entity: 'payout_requests',
    entityId: inserted.id,
    newValue: {
      amount,
      method: method.id,
      destination: destination || null,
      dropverseFee: DROPVERSE_PAYOUT_FEE_USD,
      estimatedNet: est.estimatedNet,
      // Provider transfer not activated
      transferActivated: false,
    },
  })

  return new Response(
    JSON.stringify({
      ok: true,
      duplicate: false,
      request: {
        id: inserted.id,
        amount: Number(inserted.amount),
        status: inserted.status,
        requestedAt: inserted.requested_at,
        method: method.id,
      },
      fee: est,
      nextScheduledProcessingDate: nextScheduledProcessingDate().toISOString().slice(0, 10),
      message:
        'Payout request recorded. It will be reviewed and processed on a scheduled payout date. No automatic transfer has been sent yet.',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
