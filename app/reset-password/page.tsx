'use client'

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Brand from '../../components/Brand'
import { createClient } from '../../lib/supabase'

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen grid-bg" aria-busy="true" />}>
    <ResetPasswordInner />
  </Suspense>
}

function ResetPasswordInner() {
  const params = useSearchParams()
  const initialized = useRef(false)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const code = params.get('code')
    const authError = params.get('error_description')
    if (authError) {
      setError('This reset link is invalid or has expired. Request a new one.')
      setReady(false)
      return
    }
    ;(async () => {
      try {
        const supabase = createClient()
        let { data, error: sessionError } = await supabase.auth.getSession()
        if (!data.session && code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            // The browser client may already have exchanged the PKCE code during initialization.
            const retry = await supabase.auth.getSession()
            data = retry.data
            sessionError = retry.error
          } else {
            const refreshed = await supabase.auth.getSession()
            data = refreshed.data
            sessionError = refreshed.error
          }
        }
        if (sessionError || !data.session) {
          setError('This reset link is invalid or has expired. Request a new one.')
          return
        }
        setReady(true)
      } catch {
        setError('This reset link is invalid or has expired. Request a new one.')
      }
    })()
  }, [params])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password })
      if (updateError) throw updateError
      setComplete(true)
    } catch {
      setError('We could not update the password. The link may have expired; request a new one and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen grid-bg px-4 py-10 sm:px-5 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <Brand />
        <section className="card mt-8 rounded-3xl p-6 sm:p-8">
          <p className="text-sm text-[#d8b45a]">Secure account recovery</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold text-white">{complete ? 'Password updated' : 'Choose a new password'}</h1>
          {complete ? (
            <div role="status" className="mt-5 space-y-4 text-sm leading-6 text-[#c5d0cb]">
              <p>Your password has been updated. You can now sign in with the new password.</p>
              <Link href="/login" className="btn-primary inline-flex w-full justify-center rounded-xl py-3.5 text-sm font-semibold">Go to sign in</Link>
            </div>
          ) : ready ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-[#d9e0dc]">
                New password
                <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" />
              </label>
              <label className="block text-sm font-medium text-[#d9e0dc]">
                Confirm new password
                <input type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" />
              </label>
              {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
              <button type="submit" disabled={loading} className="btn-primary w-full rounded-xl py-3.5 text-sm font-semibold disabled:opacity-60">{loading ? 'Updating…' : 'Update password'}</button>
            </form>
          ) : (
            <div className="mt-5 space-y-4 text-sm leading-6 text-[#c5d0cb]">
              <p role={error ? 'alert' : 'status'}>{error || 'Checking your secure reset link…'}</p>
              {error ? <Link href="/forgot-password" className="font-semibold text-[#d8b45a] underline underline-offset-4">Request a new reset link</Link> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
