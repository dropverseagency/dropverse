'use client'

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Brand from '../../components/Brand'
import ThemeToggle from '../../components/ThemeToggle'
import ProviderButton from '../../components/ProviderButton'
import { createClient } from '../../lib/supabase'
import { COUNTRIES, type Country } from '../../lib/countries'
import { applyPendingReferral } from '../../lib/attributeReferralAction'

const GOOGLE_SIGN_IN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === 'true'

const fieldClass =
  'mt-2 w-full rounded-xl border border-border bg-muted px-4 py-3.5 text-foreground outline-none focus:border-primary/50'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const [redirectTo] = useState(() => searchParams.get('redirect') || '/dashboard')
  const [mode, setMode] = useState<'login' | 'signup'>(() => (searchParams.get('ref') ? 'signup' : 'login'))
  const [referralPrefill] = useState(() => searchParams.get('ref') || '')
  const [loading, setLoading] = useState(false)
  const [providerLoading, setProviderLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    const supabase = createClient()
    try {
      if (mode === 'signup') {
        const fullName = String(form.get('full_name') || '').trim()
        const phone = String(form.get('phone') || '').trim()
        const username = String(form.get('username') || '').trim()
        if (!username || username.length < 3) throw new Error('Username is required (at least 3 characters).')
        const telegramUsername = String(form.get('telegram_username') || '').trim()
        const referralCode = String(form.get('referral_code') || '').trim().toUpperCase()
        if (referralCode) {
          try {
            await fetch('/api/referral/pending?code=' + encodeURIComponent(referralCode))
          } catch {
            /* non-fatal */
          }
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: { full_name: fullName, phone, username, telegram_username: telegramUsername },
          },
        })
        if (signUpError) {
          const sMsg = signUpError.message || ''
          const sDetail = ((signUpError as { details?: string }).details || '').toLowerCase()
          if (sMsg.includes('already registered') || sDetail.includes('duplicate') || sMsg.includes('duplicate')) {
            throw new Error('This email is already registered — please sign in instead, or use a different email.')
          }
          throw signUpError
        }
        applyPendingReferral().catch(() => undefined)
        if (data.session) window.location.assign(redirectTo)
        else setMessage('Account created. Please open the confirmation email we sent to your inbox, then sign in.')
      } else {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        applyPendingReferral().catch(() => undefined)
        window.location.assign(await firstLoginTarget(supabase, signInData?.user?.id ?? ''))
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleProvider(provider: 'google') {
    setError(null)
    setMessage(null)
    setProviderLoading(provider)
    const supabase = createClient()
    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(redirectTo)}` },
    })
    if (providerError) {
      setError(providerError.message)
      setProviderLoading(null)
    }
  }

  async function firstLoginTarget(
    supabase: ReturnType<typeof createClient>,
    userId: string,
  ): Promise<string> {
    if (!userId) return redirectTo
    const { data } = await supabase.from('organizations').select('id').limit(1)
    if (data && data.length > 0) return redirectTo
    return '/pricing'
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash.length < 3) return
    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(window.location.hash).then(async ({ data, error }) => {
      if (!error) {
        applyPendingReferral().catch(() => undefined)
        window.location.assign(await firstLoginTarget(supabase, data.session?.user?.id ?? ''))
      }
    })
  }, [redirectTo])

  return (
    <main className="relative min-h-screen bg-background px-5 py-12 text-foreground sm:py-20">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-md">
        <Brand />
        <div className="card mt-8 rounded-3xl border border-border bg-card p-7 sm:p-8">
          <p className="text-sm text-primary">{mode === 'login' ? 'Welcome back' : 'Start your journey'}</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold text-foreground">
            {mode === 'login' ? 'Sign in to DropVerse' : 'Create your account'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Access services, work samples and the tools you need to build your Drop Servicing business.
          </p>

          {GOOGLE_SIGN_IN_ENABLED ? (
            <>
              <div className="mt-7 grid gap-3">
                <ProviderButton
                  provider="google"
                  label="Google"
                  loading={providerLoading === 'google'}
                  onClick={() => handleProvider('google')}
                  logo={
                    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  }
                />
              </div>
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[.16em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or email
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <label className="block text-sm font-medium text-foreground">
                  Full name
                  <input name="full_name" className={fieldClass} type="text" placeholder="Your full name" required autoComplete="name" />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Mobile number{' '}
                  <span className="text-xs font-normal text-muted-foreground">(must work on WhatsApp or Telegram)</span>
                  <CountryPhoneField />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Username
                  <input name="username" className={fieldClass} type="text" placeholder="Pick a username" required minLength={3} autoComplete="username" />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Telegram username <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  <input name="telegram_username" className={fieldClass} type="text" placeholder="@username" autoComplete="nickname" />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Referral code{' '}
                  <span className="text-xs font-normal text-muted-foreground">(optional — from a friend&apos;s invite link)</span>
                  <input
                    name="referral_code"
                    id="referral_code"
                    className={`${fieldClass} uppercase`}
                    type="text"
                    placeholder="DV-XXXXXXXX"
                    maxLength={12}
                    autoComplete="off"
                    defaultValue={referralPrefill}
                  />
                </label>
              </>
            )}
            <label className="block text-sm font-medium text-foreground">
              Email address
              <input name="email" className={fieldClass} type="email" placeholder="you@example.com" required autoComplete="email" />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Password
              <input
                name="password"
                className={fieldClass}
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            {message && (
              <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{message}</p>
            )}
            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>
            )}
            <button
              disabled={loading || Boolean(providerLoading)}
              className="w-full rounded-xl bg-primary px-5 py-3.5 font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          {mode === 'signup' && (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Please make sure your phone number works on WhatsApp or Telegram so we can contact you when needed.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setMessage(null)
            }}
            className="mt-5 w-full text-sm text-muted-foreground hover:text-primary"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          <Link href="/" className="mt-5 block text-center text-xs text-muted-foreground hover:text-primary">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}

function CountryPhoneField() {
  const [country, setCountry] = useState<Country>(() => {
    const lang = typeof navigator !== 'undefined' ? navigator.language : 'en'
    const cc = lang.split('-').pop()?.toUpperCase() || 'US'
    return COUNTRIES.find((c) => c.iso2 === cc) || COUNTRIES.find((c) => c.iso2 === 'US')!
  })
  const [number, setNumber] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.dialCode.includes(q.replace(/\+/, '')),
    )
  }, [query])

  function pick(c: Country) {
    setCountry(c)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="mt-2 flex items-stretch gap-2">
      <div ref={boxRef} className="relative w-[11rem] shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-full w-full items-center gap-2 rounded-xl border border-border bg-muted px-2 py-3.5 text-sm outline-none focus:border-primary/50"
          aria-label="Choose country code"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="font-semibold text-foreground">{country.iso2}</span>
          <span className="text-muted-foreground">{country.dialCode}</span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-40 mt-1 w-[16rem] overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
            <div className="border-b border-border p-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code..."
                autoFocus
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No country found</li>}
              {filtered.map((c) => (
                <li key={`${c.iso2}-${c.dialCode}-${c.name}`}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted ${
                      c.iso2 === country.iso2 ? 'bg-primary/10 text-primary' : 'text-foreground'
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="w-8 font-semibold">{c.iso2}</span>
                    <span className="w-12 text-muted-foreground">{c.dialCode}</span>
                    <span className="flex-1 truncate text-left">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <input
        className={fieldClass}
        type="tel"
        inputMode="tel"
        placeholder="555 123 4567"
        required
        value={number}
        onChange={(e) => setNumber(e.target.value)}
      />
      <input type="hidden" name="phone" value={`${country.dialCode} ${number.trim()}`} />
    </div>
  )
}
