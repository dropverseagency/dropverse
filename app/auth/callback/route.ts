import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { runNewSignupAgent } from '@/lib/agents/newSignupAgent'

/**
 * OAuth callback for Google / Apple (and any Supabase provider).
 * Exchanges the auth code for a session and sets cookies, then redirects.
 *
 * Supabase Dashboard → Authentication → URL Configuration must include:
 *   {SITE_URL}/auth/callback
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextRaw = url.searchParams.get('next') || url.searchParams.get('redirect') || '/dashboard'
  // Prevent open redirects
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard'
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              /* set from Server Component context may throw — safe to ignore on route */
            }
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback]', error.message)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('OAuth sign-in failed. Please try again.')}`,
      )
    }

    // Best-effort admin notify (idempotent per user via agent_events).
    // First OAuth arrival notifies; later logins are skipped as DUPLICATE.
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.id) {
        void runNewSignupAgent({ userId: user.id, email: user.email ?? null }).catch((e) => {
          console.error('[auth/callback] new-signup agent', e)
        })
      }
    } catch (e) {
      console.error('[auth/callback] new-signup agent setup', e)
    }
  }

  // Client page finishes routing (onboarding vs dashboard)
  return NextResponse.redirect(
    `${origin}/login?oauth=1&redirect=${encodeURIComponent(next)}`,
  )
}
