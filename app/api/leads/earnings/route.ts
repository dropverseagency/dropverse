import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'
import { requireUser, sellerBalance } from '@/lib/leads/auth'

export const runtime = 'nodejs'

/** GET /api/leads/earnings — seller balance + ledger + payouts */
export async function GET() {
  try {
    const { userId } = await requireUser()
    const admin = adminClient()
    const balance = await sellerBalance(userId)

    const { data: ledger } = await admin
      .from('lead_marketplace_ledger')
      .select('id, event, amount, balance_after, note, purchase_id, created_at')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    const { data: payouts } = await admin
      .from('lead_payout_requests')
      .select('id, amount, status, requested_at, reviewed_at, paid_at, admin_note')
      .eq('seller_id', userId)
      .order('requested_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      balance,
      ledger: ledger ?? [],
      payouts: payouts ?? [],
    })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}

/** POST /api/leads/earnings — request payout { amount } */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireUser()
    const body = await request.json().catch(() => ({}))
    const amount = Math.round(Number(body?.amount || 0) * 100) / 100
    if (!(amount > 0)) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
    }

    const balance = await sellerBalance(userId)
    if (amount > balance) {
      return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: pending } = await admin
      .from('lead_payout_requests')
      .select('id')
      .eq('seller_id', userId)
      .eq('status', 'pending')
      .limit(1)

    if (pending && pending.length > 0) {
      return NextResponse.json({ error: 'PENDING_PAYOUT_EXISTS' }, { status: 409 })
    }

    const { data, error } = await admin
      .from('lead_payout_requests')
      .insert({ seller_id: userId, amount, status: 'pending' })
      .select('id, amount, status, requested_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'REQUEST_FAILED' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, payout: data })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
