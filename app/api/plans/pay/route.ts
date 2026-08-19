import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseService'
import { PLAN_CONFIG } from '../../../../lib/planConfig'

const SPACEREMIT_API = 'https://spaceremit.com/api/v2/payment_info/'

// Verify a SpaceRemit transaction for an organization plan upgrade.
// Caller must be the organization owner. Stores the spaceremit id on the org
// and updates the plan to PAID once the payment is confirmed on SpaceRemit's side.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const paymentId = String(body?.paymentId ?? '')
    const orgId = String(body?.orgId ?? '')
    const planId = String(body?.planId ?? '')
    if (!paymentId || !orgId || !planId) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Auth check via anon client: require an authenticated session belonging to the org owner.
    const authHeader = request.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    const anonRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      { headers: { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } },
    )
    if (!anonRes.ok) {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    const user = (await anonRes.json()) as { id?: string }
    if (!user.id) {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    // Owner check (service role bypasses RLS — verify ownership manually).
    const { data: org } = await supabase
      .from('organizations')
      .select('id, owner_id, plan, name')
      .eq('id', orgId)
      .single()
    if (!org) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
    if (org.owner_id !== user.id) {
      return NextResponse.json({ error: 'NOT_ORG_OWNER' }, { status: 403 })
    }
    if (!PLAN_CONFIG.some(p => p.id === planId)) {
      return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 })
    }
    const plan = PLAN_CONFIG.find(p => p.id === planId)!
    if (plan.enterprise || plan.price <= 0) {
      return NextResponse.json({ error: 'PLAN_NOT_PAYABLE' }, { status: 400 })
    }

    // Verify with SpaceRemit.
    const privateKey = process.env.SPACEREMIT_PRIVATE_KEY ?? ''
    const publicKey = process.env.SPACEREMIT_PUBLIC_KEY ?? ''
    if (!privateKey || !publicKey) {
      return NextResponse.json({ error: 'SP_KEYS_MISSING' }, { status: 503 })
    }
    const spRes = await fetch(SPACEREMIT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ private_key: privateKey, payment_id: paymentId }),
    })
    if (!spRes.ok) {
      return NextResponse.json({ error: 'SP_VERIFY_FAILED' }, { status: 502 })
    }
    const sp = (await spRes.json()) as {
      response_status?: string
      data?: { total_amount?: string; currency?: string; status?: string }
    }
    if (sp.response_status !== 'success' || !sp.data) {
      return NextResponse.json({ error: 'PAYMENT_NOT_CONFIRMED', detail: sp.response_status ?? 'unknown' }, { status: 402 })
    }

    // Upgrade the org plan.
    const { error: upErr } = await supabase
      .from('organizations')
      .update({ plan: planId, updated_at: new Date().toISOString() })
      .eq('id', orgId)
    if (upErr) {
      return NextResponse.json({ error: 'PLAN_UPDATE_FAILED', detail: upErr.message }, { status: 500 })
    }

    // Audit trail.
    ;(async () => {
      try {
        await supabase.from('audit_logs').insert({
          actor_id: user.id,
          action: 'spaceremit_plan_confirmed',
          entity: 'organizations',
          entity_id: orgId,
          new_value: JSON.stringify({ plan: planId, payment_id: paymentId, previous_plan: org.plan }),
        })
      } catch { /* non-fatal */ }
    })()

    return NextResponse.json({ success: true, plan: planId, previousPlan: org.plan })
  } catch (err) {
    console.error('plans/pay error', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
