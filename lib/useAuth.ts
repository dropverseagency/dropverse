'use client'
import { useEffect, useState } from 'react'
import { createClient } from './supabase'

/**
 * Login state hook used site-wide (header, nav, etc).
 *
 * The Supabase browser client splits a long session into chunked cookies
 * (`sb-<ref>-auth-token.0`, `.1`, ...), and `getSession()` can return null
 * immediately after a redirect before the client reassembles them. This hook
 * retries a few times (like the dashboard does) before giving up, so pages
 * keep showing the user as signed in everywhere.
 */
export interface AuthState {
  loading: boolean
  user: { id: string; email?: string; name?: string | null } | null
}

export function useAuth(retries = 5, delay = 600): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, user: null })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      let user: AuthState['user'] = null
      for (let attempt = 0; attempt < retries; attempt++) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session) {
          user = {
            id: session.user.id,
            email: session.user.email,
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.username ||
              session.user.email?.split('@')[0] ||
              null,
          }
          break
        }
        if (attempt < retries - 1) await new Promise((r) => setTimeout(r, delay))
      }
      if (cancelled) return
      setState({ loading: false, user })
      // Also listen for auth changes so sign out updates the header live.
      supabase.auth.onAuthStateChange((_event, session) => {
        setState({
          loading: false,
          user: session
            ? {
                id: session.user.id,
                email: session.user.email,
                name:
                  session.user.user_metadata?.full_name ||
                  session.user.user_metadata?.username ||
                  session.user.email?.split('@')[0] ||
                  null,
              }
            : null,
        })
      })
    })()
    return () => {
      cancelled = true
    }
  }, [retries, delay])

  return state
}
