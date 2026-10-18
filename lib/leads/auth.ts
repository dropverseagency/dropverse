import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { adminClient, sessionClient } from '@/lib/adminCore'

export async function requireUser(): Promise<{ userId: string; email: string | null }> {
  const hdrs = await headers()
  const bearer = (hdrs.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  let user = null as { id: string; email?: string | null } | null

  if (bearer) {
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const res = await supa.auth.getUser(bearer)
    user = res.data.user
  } else {
    const supabase = await sessionClient()
    const res = await supabase.auth.getUser()
    user = res.data.user
  }

  if (!user) {
    const err = new Error('NOT_AUTHENTICATED')
    ;(err as Error & { code: string }).code = 'NOT_AUTHENTICATED'
    throw err
  }
  return { userId: user.id, email: user.email ?? null }
}

export async function sellerBalance(sellerId: string): Promise<number> {
  const admin = adminClient()
  const { data } = await admin
    .from('lead_marketplace_ledger')
    .select('amount')
    .eq('seller_id', sellerId)
  const sum = (data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)
  return Math.round(sum * 100) / 100
}
