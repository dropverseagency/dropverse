import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'
import { notifyAdminEvent } from '@/lib/agents/adminNotify'

export const runtime = 'nodejs'

/** Verify the provider payment first, then commit purchase, seat count and seller ledger atomically. */
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await requireUser()
    const body = (await request.json().catch(() => ({}))) as { purchaseId?: string; paymentId?: string }
    const purchaseId = String(body.purchaseId || '').trim()
    const paymentId = String(body.paymentId || '').trim()
    if (!purchaseId || !paymentId) return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })

    const privateKey = process.env.SPACEREMIT_PRIVATE_KEY || ''
    if (!privateKey || privateKey.startsWith('PLACEHOLDER')) {
      return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
    }

    const admin = adminClient()
    const { data: purchase, error: purchaseError } = await admin
      .from('lead_pack_purchases')
      .select('id, buyer_id, pack_id, price_usd, status, expires_at')
      .eq('id', purchaseId)
      .single()

    if (purchaseError || !purchase) return NextResponse.json({ error: 'PURCHASE_NOT_FOUND' }, { status: 404 })
    if (purchase.buyer_id !== userId) return NextResponse.json({ error: 'NOT_ALLOWED' }, { status: 403 })

    if (purchase.status === 'paid') {
      const { data: credit, error: creditError } = await admin
        .from('lead_marketplace_ledger')
        .select('id')
        .eq('purchase_id', purchaseId)
        .eq('event', 'sale_credit')
        .maybeSingle()
      if (creditError) return NextResponse.json({ error: 'LEDGER_LOOKUP_FAILED' }, { status: 500 })
      if (credit) return NextResponse.json({ ok: true, alreadyConfirmed: true })
      // Do not silently repair accounting through multiple non-atomic writes.
      return NextResponse.json({ error: 'LEDGER_RECONCILIATION_REQUIRED' }, { status: 409 })
    }

    const lateExpiredPayment =
      purchase.status === 'cancelled' &&
      Boolean(purchase.expires_at) &&
      new Date(purchase.expires_at as string).getTime() <= Date.now()
    if (purchase.status !== 'pending_payment' && !lateExpiredPayment) {
      return NextResponse.json({ error: 'NOT_PAYABLE' }, { status: 409 })
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
    if (!consent || consentValue?.accepted !== true || consentValue?.terms_version !== '2026-10-28') {
      return NextResponse.json({ error: 'TERMS_ACCEPTANCE_REQUIRED' }, { status: 400 })
    }

    const spRes = await fetch('https://spaceremit.com/api/v2/payment_info/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
      cache: 'no-store',
    })
    let spData: { response_status?: string; data?: { total_amount?: number | string; currency?: string; status?: string } } | null = null
    try {
      spData = await spRes.json()
    } catch {
      return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 502 })
    }
    if (!spRes.ok || spData?.response_status !== 'success' || !spData?.data) {
      return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 422 })
    }

    const paymentStatus = String(spData.data.status || '').toUpperCase()
    if (!['SUCCESS', 'CONFIRMED', 'COMPLETED'].includes(paymentStatus)) {
      return NextResponse.json({ error: 'PAYMENT_NOT_COMPLETE' }, { status: 402 })
    }

    const paid = Number(spData.data.total_amount || 0)
    const expected = Number(purchase.price_usd)
    if (spData.data.currency !== 'USD' || !Number.isFinite(paid) || Math.abs(paid - expected) >= 0.01) {
      return NextResponse.json({ error: 'SP_AMOUNT_MISMATCH' }, { status: 422 })
    }

    const { data: result, error: commitError } = await admin.rpc('confirm_lead_pack_purchase_atomic', {
      p_purchase_id: purchaseId,
      p_payment_id: paymentId,
    })
    if (commitError || !result || typeof result !== 'object') {
      const reason = commitError?.message || 'CONFIRM_FAILED'
      if (reason.includes('PURCHASE_NOT_FOUND') || reason.includes('PACK_NOT_FOUND')) {
        return NextResponse.json({ error: 'PURCHASE_NOT_FOUND' }, { status: 404 })
      }
      if (reason.includes('SOLD_OUT_PAYMENT_REQUIRES_REVIEW')) {
        return NextResponse.json({
          error: 'PAYMENT_REQUIRES_REVIEW',
          message: 'Payment was verified, but the buyer limit was reached after this reservation expired. Contact support for manual reconciliation or refund.',
        }, { status: 409 })
      }
      if (reason.includes('NOT_PAYABLE')) return NextResponse.json({ error: 'NOT_PAYABLE' }, { status: 409 })
      if (reason.includes('PAYMENT_ID_REUSED')) return NextResponse.json({ error: 'PAYMENT_ID_REUSED' }, { status: 409 })
      if (reason.includes('DUPLICATE_LATE_PAYMENT_REQUIRES_REVIEW')) return NextResponse.json({ error: 'PAYMENT_REQUIRES_REVIEW', message: 'A newer checkout already exists for this buyer and pack. Contact support for manual reconciliation or refund.' }, { status: 409 })
      if (reason.includes('LEDGER_RECONCILIATION_REQUIRED')) return NextResponse.json({ error: 'LEDGER_RECONCILIATION_REQUIRED' }, { status: 409 })
      console.error('[leads] atomic payment confirmation failed', reason)
      return NextResponse.json({ error: 'CONFIRM_FAILED' }, { status: 500 })
    }

    const committed = result as {
      ok?: boolean
      confirmed?: boolean
      alreadyConfirmed?: boolean
      amount?: number
      platformFee?: number
      sellerNet?: number
      commissionRate?: number
    }
    if (committed.alreadyConfirmed) return NextResponse.json({ ok: true, alreadyConfirmed: true })

    await audit({
      actorId: userId,
      actorEmail: email,
      action: 'lead_purchase_paid',
      entity: 'lead_pack_purchase',
      entityId: purchaseId,
      newValue: {
        paymentId,
        amount: Number(committed.amount ?? expected),
        commission_rate: Number(committed.commissionRate ?? 0.2),
        seller_net: Number(committed.sellerNet ?? 0),
        platform_fee: Number(committed.platformFee ?? 0),
      },
    })

    void notifyAdminEvent({
      agent: 'lead_purchase_paid',
      idempotencyKey: `lead_purchase_paid:${purchaseId}`,
      entityId: purchaseId,
      title: 'Lead pack purchase paid',
      lines: [
        `Purchase: ${purchaseId}`,
        `Amount: $${Number(committed.amount ?? expected)}`,
        `Platform fee: $${Number(committed.platformFee ?? 0)}`,
        `Seller net: $${Number(committed.sellerNet ?? 0)}`,
      ],
      adminPath: '/admin/leads',
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
