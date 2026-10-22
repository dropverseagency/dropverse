import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

const CURRENT_TERMS_VERSION = '2026-10-23'
const ALLOWED_ITEM_TYPES = new Set(['subscription', 'lead_pack', 'project', 'invoice', 'digital_service'])

/** Record affirmative Terms + Refund Policy acceptance before a paid checkout. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      accepted?: boolean
      termsVersion?: string
      itemType?: string
      itemId?: string
      itemName?: string
    }
    const itemType = String(body.itemType || '')
    let userId: string | null = null
    let email: string | null = null

    if (itemType === 'invoice') {
      const invoiceId = String(body.itemId || '').trim()
      if (!invoiceId) return NextResponse.json({ error: 'INVOICE_REQUIRED' }, { status: 400 })
      const { data: invoice, error: invoiceError } = await adminClient()
        .from('invoices')
        .select('id, status, client_email, amount, currency')
        .eq('id', invoiceId)
        .single()
      if (invoiceError || !invoice || invoice.status !== 'PENDING') {
        return NextResponse.json({ error: 'INVOICE_NOT_PAYABLE' }, { status: 409 })
      }
      email = invoice.client_email || null
    } else {
      const { requireUser } = await import('@/lib/leads/auth')
      const user = await requireUser()
      userId = user.userId
      email = user.email
    }

    if (body.accepted !== true) {
      return NextResponse.json({ error: 'TERMS_ACCEPTANCE_REQUIRED' }, { status: 400 })
    }
    if (body.termsVersion !== CURRENT_TERMS_VERSION) {
      return NextResponse.json({ error: 'TERMS_VERSION_MISMATCH', currentTermsVersion: CURRENT_TERMS_VERSION }, { status: 409 })
    }
    if (!ALLOWED_ITEM_TYPES.has(itemType)) {
      return NextResponse.json({ error: 'INVALID_PURCHASE_TYPE' }, { status: 400 })
    }

    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const ip = forwardedFor.split(',')[0]?.trim().slice(0, 80) || request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null
    const { error } = await adminClient().from('audit_logs').insert({
      actor_id: userId,
      actor_email: email,
      action: 'checkout_terms_accepted',
      entity: itemType,
      entity_id: String(body.itemId || '').slice(0, 120) || null,
      new_value: {
        accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
        accepted_at: new Date().toISOString(),
        item_name: String(body.itemName || '').slice(0, 180),
        refund_policy_version: CURRENT_TERMS_VERSION,
        ip,
        user_agent: userAgent,
        method: 'explicit_checkbox_before_checkout',
      },
    })
    if (error) {
      console.error('[legal acceptance] audit insert failed', error.message)
      return NextResponse.json({ error: 'TERMS_ACCEPTANCE_COULD_NOT_BE_RECORDED' }, { status: 503 })
    }

    return NextResponse.json({ ok: true, termsVersion: CURRENT_TERMS_VERSION })
  } catch (error) {
    if ((error as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('[legal acceptance]', error)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
