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

/**
 * POST /api/payouts/request
 * Creates a pending request through a database transaction that locks the
 * user's payout ledger, verifies available funds, and reserves the amount.
 * No payment provider is called by this endpoint.
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

  const destination = typeof body.destination === 'string' ? body.destination.trim().slice(0, 200) : ''
  if (method.id === 'paypal' && destination && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
    return new Response(JSON.stringify({ error: 'INVALID_DESTINATION', message: 'Enter a valid PayPal email address.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return new Response(JSON.stringify({ error: 'INVALID_IDEMPOTENCY_KEY' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
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

  // One database transaction checks balance and reserves it. Read errors fail
  // the RPC instead of being mistaken for a zero/empty balance.
  const admin = adminClient()
  const { data: result, error } = await admin.rpc('create_payout_request_atomic', {
    p_user_id: user.id,
    p_amount: amount,
    p_method: method.id,
    p_destination: destination || null,
    p_dropverse_fee: est.dropverseFee,
    p_estimated_net: est.estimatedNet,
    p_idempotency_key: idempotencyKey,
  })

  if (error || !result || typeof result !== 'object') {
    console.error('[payouts/request] atomic reservation failed', error)
    return new Response(JSON.stringify({ error: 'SAVE_FAILED', message: 'Unable to reserve this payout. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (result.ok !== true) {
    if (result.error === 'INSUFFICIENT_BALANCE') {
      return new Response(JSON.stringify({
        error: 'INSUFFICIENT_BALANCE',
        message: 'Requested amount exceeds your available balance.',
        available: Number(result.available ?? 0),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('[payouts/request] atomic reservation rejected', result.error)
    return new Response(JSON.stringify({ error: 'SAVE_FAILED' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const saved = result.request
  if (!saved || typeof saved.id !== 'string') {
    console.error('[payouts/request] atomic reservation returned an invalid result')
    return new Response(JSON.stringify({ error: 'SAVE_FAILED' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!result.duplicate) {
    await audit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'payout_requested',
      entity: 'payout_requests',
      entityId: saved.id,
      newValue: {
        amount: Number(saved.amount),
        method: saved.method,
        // Do not duplicate payout destination PII in audit logs.
        dropverseFee: Number(saved.dropverse_fee),
        estimatedNet: Number(saved.estimated_net),
        idempotencyKey,
        transferActivated: false,
      },
    })
  }

  return new Response(
    JSON.stringify({
      ok: true,
      duplicate: Boolean(result.duplicate),
      request: {
        id: saved.id,
        amount: Number(saved.amount),
        status: saved.status,
        requestedAt: saved.requested_at,
        method: saved.method,
      },
      fee: {
        gross: Number(saved.amount),
        dropverseFee: Number(saved.dropverse_fee),
        estimatedNet: Number(saved.estimated_net),
      },
      nextScheduledProcessingDate: nextScheduledProcessingDate().toISOString().slice(0, 10),
      message: result.duplicate
        ? 'This payout request was already recorded.'
        : 'Payout request recorded and balance reserved. No automatic transfer has been sent yet.',
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  )
}
