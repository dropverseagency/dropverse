import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/adminCore'
import { createWhopPlan } from '@/lib/whop'

export const runtime = 'nodejs'

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

    const body = await request.json().catch(() => ({})) as { projectId?: string }
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'PROJECT_ID_REQUIRED' }, { status: 400 })

    const admin = adminClient()
    const { data: project, error } = await admin.from('projects')
      .select('id,user_id,title,client_price,currency,payment_status,status,project_type')
      .eq('id', projectId).eq('user_id', user.id).single()
    if (error || !project) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
    if (project.payment_status === 'PAYMENT_CONFIRMED') {
      return NextResponse.json({ error: 'ALREADY_PAID' }, { status: 409 })
    }

    const amount = Math.round(Number(project.client_price) * 100) / 100
    if (!(amount > 0)) return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
    const { planId } = await createWhopPlan({
      productId: process.env.WHOP_PROJECT_PRODUCT_ID || '',
      title: `DV Project ${project.id.slice(0, 8)}`,
      amount,
      planType: 'one_time',
    })

    const { error: mapError } = await admin.from('whop_checkout_sessions').insert({
      plan_id: planId,
      target_type: 'project',
      target_id: project.id,
      user_id: user.id,
      expected_amount: amount,
      currency: 'USD',
      status: 'pending',
    })
    if (mapError) {
      console.error('[whop] project session insert failed', mapError.message)
      return NextResponse.json({ error: 'CHECKOUT_SESSION_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, planId, amount, currency: 'USD' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INTERNAL'
    const status = message === 'WHOP_NOT_CONFIGURED' || message === 'WHOP_PRODUCT_NOT_CONFIGURED' ? 503 : 500
    console.error('[whop] project checkout', message)
    return NextResponse.json({ error: message === 'WHOP_NOT_CONFIGURED' || message === 'WHOP_PRODUCT_NOT_CONFIGURED' ? message : 'CHECKOUT_FAILED' }, { status })
  }
}
