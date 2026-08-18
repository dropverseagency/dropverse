'use server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { attributeReferral } from './commissionEngine'
import { adminClient } from './adminCore'

const PENDING_COOKIE = 'dv_referral_code'

/**
 * Apply a pending referral code to the current signed-in user.
 * Safe to call repeatedly: self-referrals and duplicates are rejected with a reason.
 */
export async function applyPendingReferral() {
  const cookieStore = await cookies()
  const pendingCode = cookieStore.get(PENDING_COOKIE)?.value
  if (!pendingCode) return { applied: false, reason: 'NO_PENDING_CODE' }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { applied: false, reason: 'NOT_AUTHENTICATED' }

  const result = await attributeReferral({
    referredUserId: user.id,
    code: pendingCode,
    sourceUrl: null,
    sourceChannel: 'signup',
  })

  // Clear the pending cookie once we've attempted attribution (idempotent afterward).
  cookieStore.delete(PENDING_COOKIE)

  return { applied: result.referred, reason: result.reason, referrerId: (result as any).referrerId ?? null }
}
