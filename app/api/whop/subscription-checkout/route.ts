import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/adminCore'
import { PLAN_CONFIG } from '@/lib/planConfig'
import { createWhopCheckout, retrieveWhopPlan } from '@/lib/whop'

export const runtime = 'nodejs'

const PLAN_IDS: Record<string, string | undefined> = {
  AGENCY: process.env.NEXT_PUBLIC_WHOP_AGENCY_MONTHLY_PLAN_ID,
  AGENCY_PRO: process.env.NEXT_PUBLIC_WHOP_AGENCY_PRO_MONTHLY_PLAN_ID,
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

    const body = await request.json().catch(() => ({})) as { organizationId?: string; planKey?: string }
    const organizationId = String(body.organizationId || '').trim()
    const planKey = String(body.planKey || '').trim()
    if (!organizationId || !['AGENCY', 'AGENCY_PRO'].includes(planKey)) {
      return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 })
    }

    const planId = PLAN_IDS[planKey]
    if (!planId) return NextResponse.json({ error: 'WHOP_SUBSCRIPTION_PLAN_NOT_CONFIGURED' }, { status: 503 })
    const plan = PLAN_CONFIG.find((item) => item.id === planKey)
    if (!plan || plan.price <= 0) return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 })

    const admin = adminClient()
    const { data: org, error: orgError } = await admin.from('organizations')
      .select('id,owner_id,plan,status').eq('id', organizationId).eq('owner_id', user.id).single()
    if (orgError || !org) return NextResponse.json({ error: 'ORGANIZATION_NOT_FOUND' }, { status: 404 })
    if (org.plan === planKey) return NextResponse.json({ error: 'PLAN_ALREADY_ACTIVE' }, { status: 409 })

    const { data: priorSession } = await adminClient().from('whop_checkout_sessions')
      .select('id,checkout_id,expected_amount')
      .eq('target_type', 'subscription').eq('target_id', organizationId).eq('user_id', user.id)
      .eq('status', 'pending').eq('plan_id', planId).not('checkout_id', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (priorSession?.checkout_id && Math.abs(Number(priorSession.expected_amount) - plan.price) < 0.01) {
      return NextResponse.json({ ok: true, sessionId: priorSession.checkout_id, planKey, amount: plan.price, currency: 'USD' })
    }

    const whopPlan = await retrieveWhopPlan(planId)
    const recurringPrice = Number(whopPlan.renewal_price)
    if (whopPlan.id !== planId || whopPlan.plan_type !== 'renewal' ||
        !Number.isFinite(recurringPrice) || Math.abs(recurringPrice - plan.price) >= 0.01 ||
        String(whopPlan.currency || 'usd').toLowerCase() !== 'usd') {
      console.error('[whop] configured subscription plan does not match DropVerse price', { planKey, planId })
      return NextResponse.json({ error: 'WHOP_PLAN_CONFIGURATION_MISMATCH' }, { status: 503 })
    }

    const { data: session, error: insertError } = await admin.from('whop_checkout_sessions').insert({
      plan_id: planId, target_type: 'subscription', target_id: organizationId, user_id: user.id,
      expected_amount: plan.price, currency: 'USD', status: 'pending', metadata: { plan_key: planKey },
    }).select('id').single()
    if (insertError || !session) return NextResponse.json({ error: 'CHECKOUT_SESSION_FAILED' }, { status: 500 })

    const { sessionId } = await createWhopCheckout(planId, session.id)
    const { error: checkoutError } = await admin.from('whop_checkout_sessions')
      .update({ checkout_id: sessionId }).eq('id', session.id)
    if (checkoutError) return NextResponse.json({ error: 'CHECKOUT_SESSION_FAILED' }, { status: 500 })

    return NextResponse.json({ ok: true, sessionId, planKey, amount: plan.price, currency: 'USD' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INTERNAL'
    if (message === 'NOT_AUTHENTICATED') return NextResponse.json({ error: message }, { status: 401 })
    console.error('[whop] subscription checkout failed', message)
    return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 500 })
  }
}
