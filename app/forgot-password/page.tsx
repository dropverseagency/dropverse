'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import Brand from '../../components/Brand'
import { createClient } from '../../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey) return
    if (document.querySelector('script[data-turnstile]')) return
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true
    s.dataset.turnstile = '1'
    document.head.appendChild(s)
  }, [siteKey])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const form = new FormData(event.currentTarget)
      const turnstileToken =
        typeof form.get('cf-turnstile-response') === 'string' && form.get('cf-turnstile-response')
          ? String(form.get('cf-turnstile-response'))
          : null

      const guardRes = await fetch('/api/auth/guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken }),
      })
      if (guardRes.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.')
        return
      }
      if (!guardRes.ok) {
        setError('Security check failed. Please try again.')
        return
      }

      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) throw resetError
      // Keep the response generic to avoid revealing whether an email is registered.
      setSent(true)
    } catch {
      setError('We could not send the reset email right now. Please try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen grid-bg px-4 py-10 sm:px-5 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <Brand />
        <section className="card mt-8 rounded-3xl p-6 sm:p-8">
          <p className="text-sm text-[#d8b45a]">Account recovery</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold text-white">Forgot your password?</h1>
          <p className="mt-3 text-sm leading-6 text-[#8fa29c]">
            Enter the email connected to your DropVerse account. We will send a secure reset link if it can be used.
          </p>
          {sent ? (
            <div role="status" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-[#c5d0cb]">
              If an account matches that email, a password reset link is on its way. Check your inbox and spam folder.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-[#d9e0dc]">
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
                  placeholder="you@example.com"
                />
              </label>
              {siteKey ? (
                <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" />
              ) : null}
              {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
              <button type="submit" disabled={loading} className="btn-primary w-full rounded-xl py-3.5 text-sm font-semibold disabled:opacity-60">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-[#8fa29c]">
            Remembered it? <Link href="/login" className="font-semibold text-[#d8b45a]">Back to sign in</Link>
          </p>
        </section>
        <p className="mt-6 text-center text-xs text-[#718781]"><Link href="/" className="hover:text-[#d8b45a]">← Back to home</Link></p>
      </div>
    </main>
  )
}
