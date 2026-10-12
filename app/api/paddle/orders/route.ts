import { NextResponse } from 'next/server'
import { adminClient, sessionClient } from '@/lib/adminCore'

export const runtime = 'nodejs'

export async function GET() {
  const session = await sessionClient()
  const { data, error } = await session.auth.getUser()
  if (error || !data.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const { data: orders, error: ordersError } = await adminClient()
    .from('paddle_orders')
    .select('id, transaction_id, status, amount, currency_code, plan_id, organization_id, customer_id, subscription_id, created_at, updated_at, metadata')
    .eq('user_id', data.user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (ordersError) return NextResponse.json({ error: 'ORDERS_READ_FAILED' }, { status: 500 })
  return NextResponse.json({ orders: orders ?? [] })
}
