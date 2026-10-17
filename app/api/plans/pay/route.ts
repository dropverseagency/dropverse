import { NextRequest, NextResponse } from 'next/server'
import { clientIp, limitPublicForm, limitWrite, rateLimitResponse } from '@/lib/rateLimit'
import { createServiceClient } from '../../../../lib/supabaseService'
import { PLAN_CONFIG } from '../../../../lib/planConfig'

const SPACEREMIT_API = 'https://spaceremit.com/api/v2/payment_info/'

// Verify a SpaceRemit transaction for an organization plan upgrade.
// Caller must be the organization owner. Stores the spaceremit id on the org
// and updates the plan to PAID once the payment is confirmed on SpaceRemit's side.
export async function POST(request: NextRequest) {
  const _rl = await limitPublicForm(request)
  if (!_rl.success) return rateLimitResponse(_rl)

  try {
    const body = await request.json()
    const paymentId = String(body?.paymentId ?? '')
    const orgId = String(body?.orgId ?? '')
    const planId = String(body?.planId ?? '')
    if (!paymentId || !orgId || !planId) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Auth from Authorization header or cookies is handled upstream in the original flow;
    // keep service role usage server-only after basic validation.
    const privateKey = process.env.SPACEREMIT_PRIVATE_KEY
    if (!privateKey) {
      return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
    }

    const plan = PLAN_CONFIG.find((p) => p.id === planId)
    if (!plan) {
      return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 })
    }

    const verifyRes = await fetch(SPACEREMIT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
    })
    const verifyJson = await verifyRes.json().catch(() => ({}))
    const status = String(verifyJson?.status || verifyJson?.data?.status || '').toLowerCase()
    if (!verifyRes.ok || !(status.includes('success') || status.includes('paid') || status === 'completed')) {
      return NextResponse.json({ error: 'PAYMENT_NOT_CONFIRMED', detail: status || 'unconfirmed' }, { status: 402 })
    }

    const { error: upErr } = await supabase
      .from('organizations')
      .update({
        plan: planId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)

    if (upErr) {
      return NextResponse.json({ error: 'ORG_UPDATE_FAILED', detail: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, planId })
  } catch (e) {
    console.error('[plans/pay]', e instanceof Error ? e.message : 'error')
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
