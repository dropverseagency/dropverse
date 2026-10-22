import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'
import { effectiveMaxBuyers } from '@/lib/leads/types'

export const runtime = 'nodejs'

/**
 * POST /api/leads/purchases/confirm
 * Body: { purchaseId, paymentId }
 * Verifies SpaceRemit server-side, marks paid, increments sold_count, credits seller ledger.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await requireUser()
    const body = (await request.json().catch(() => ({}))) as {
      purchaseId?: string
      paymentId?: string
    }
    const purchaseId = String(body?.purchaseId || '').trim()
    const paymentId = String(body?.paymentId || '').trim()
    if (!purchaseId || !paymentId) {
      return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
    }

    const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
    if (!privateKey || privateKey.startsWith('PLACEHOLDER')) {
      return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
    }

    const admin = adminClient()
    const { data: purchase, error } = await admin
      .from('lead_pack_purchases')
      .select(
        'id, buyer_id, pack_id, price_usd, seller_net_usd, platform_fee_usd, status',
      )
      .eq('id', purchaseId)
      .single()

    if (error || !purchase) {
      return NextResponse.json({ error: 'PURCHASE_NOT_FOUND' }, { status: 404 })
    }
    if (purchase.buyer_id !== userId) {
      return NextResponse.json({ error: 'NOT_ALLOWED' }, { status: 403 })
    }
    if (purchase.status === 'paid') {
      return NextResponse.json({ ok: true, alreadyConfirmed: true })
    }
    if (purchase.status !== 'pending_payment') {
      return NextResponse.json({ error: 'NOT_PAYABLE' }, { status: 409 })
    }

    const { data: pack, error: packErr } = await admin
      .from('lead_packs')
      .select('id, seller_id, max_buyers, admin_max_buyers, sold_count, status, price_usd')
      .eq('id', purchase.pack_id)
      .single()

    if (packErr || !pack) {
      return NextResponse.json({ error: 'PACK_NOT_FOUND' }, { status: 404 })
    }

    const { data: consent } = await admin
      .from('audit_logs')
      .select('id, new_value')
      .eq('action', 'checkout_terms_accepted')
      .eq('entity', 'lead_pack')
      .eq('entity_id', purchase.pack_id)
      .eq('actor_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const consentValue = consent?.new_value as Record<string, unknown> | null
    if (!consent || consentValue?.accepted !== true || consentValue?.terms_version !== '2026-10-23') {
      return NextResponse.json({ error: 'TERMS_ACCEPTANCE_REQUIRED' }, { status: 400 })
    }

    const spRes = await fetch('https://spaceremit.com/api/v2/payment_info/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
    })
    let spData: {
      response_status?: string
      data?: { total_amount?: number | string; currency?: string; status?: string }
    } | null = null
    try {
      spData = await spRes.json()
    } catch {
      return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 502 })
    }
    if (spData?.response_status !== 'success' || !spData?.data) {
      return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 422 })
    }
    const tx = spData.data
    const paid = Number(tx.total_amount || 0)
    const expected = Number(purchase.price_usd)
    if (tx.currency !== 'USD' || !(Math.abs(paid - expected) < 0.01)) {
      return NextResponse.json({ error: 'SP_AMOUNT_MISMATCH' }, { status: 422 })
    }

    const effective = effectiveMaxBuyers(
      Number(pack.max_buyers),
      pack.admin_max_buyers as number | null,
    )
    if (Number(pack.sold_count) >= effective) {
      return NextResponse.json({ error: 'SOLD_OUT' }, { status: 409 })
    }

    const { error: payErr } = await admin
      .from('lead_pack_purchases')
      .update({
        status: 'paid',
        spaceremit_payment_id: paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq('id', purchaseId)
      .eq('status', 'pending_payment')

    if (payErr) {
      console.error('[leads] confirm update', payErr.message)
      return NextResponse.json({ error: 'CONFIRM_FAILED' }, { status: 500 })
    }

    const newSold = Number(pack.sold_count) + 1
    const packPatch: Record<string, unknown> = { sold_count: newSold }
    if (newSold >= effective) packPatch.status = 'sold_out'

    await admin.from('lead_packs').update(packPatch).eq('id', pack.id)

    const { data: prior } = await admin
      .from('lead_marketplace_ledger')
      .select('amount')
      .eq('seller_id', pack.seller_id)
    const priorSum = (prior ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)
    const credit = Number(purchase.seller_net_usd)
    const balanceAfter = Math.round((priorSum + credit) * 100) / 100

    await admin.from('lead_marketplace_ledger').insert({
      seller_id: pack.seller_id,
      purchase_id: purchaseId,
      event: 'sale_credit',
      amount: credit,
      balance_after: balanceAfter,
      note: `Sale of pack ${pack.id}`,
    })

    await audit({
      actorId: userId,
      actorEmail: email,
      action: 'lead_purchase_paid',
      entity: 'lead_pack_purchase',
      entityId: purchaseId,
      newValue: {
        paymentId,
        amount: expected,
        seller_net: credit,
        platform_fee: purchase.platform_fee_usd,
      },
    })

    return NextResponse.json({ ok: true, confirmed: true })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('[leads] confirm', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
