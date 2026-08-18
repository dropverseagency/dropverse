'use client'

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Brand from '../../components/Brand'
import ProviderButton from '../../components/ProviderButton'
import { createClient } from '../../lib/supabase'
import { COUNTRIES, type Country } from '../../lib/countries'
import { applyPendingReferral } from '../../lib/attributeReferralAction'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  // Use next/navigation's useSearchParams() so the values are always accurate
  // after client-side (soft) navigation — window.location.search is stale during
  // Next.js soft transitions and caused the ref mode to be missed.
  const searchParams = useSearchParams()
  const [redirectTo] = useState(() => searchParams.get('redirect') || '/dashboard')
  // Visitors arriving from an affiliate link (/r/CODE → /login?ref=CODE) land
  // directly on the sign-up form instead of the sign-in form.
  const [mode, setMode] = useState<'login' | 'signup'>(() => searchParams.get('ref') ? 'signup' : 'login')
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
        if (!username || username.length < 3) {
          throw new Error('Username is required (at least 3 characters).')
        }
        const telegramUsername = String(form.get('telegram_username') || '').trim()
        const referralCode = String(form.get('referral_code') || '').trim().toUpperCase()
        if (referralCode) {
          try {
            await fetch('/api/referral/pending?code=' + encodeURIComponent(referralCode))
          } catch { /* non-fatal — attribution retries after signup */ }
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
        // Apply any pending referral code (from a /r/... link the user clicked before signing up).
        applyPendingReferral().catch(() => undefined)
        if (data.session) window.location.assign(redirectTo)
        else setMessage('Account created. Please open the confirmation email we sent to your inbox, then sign in.')
      } else {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        // Apply any pending referral code (from a /r/... link clicked before signing in).
        // Applies once to the now-authenticated user; safe and idempotent.
        applyPendingReferral().catch(() => undefined)
        // New users (no workspace yet) start at Pricing to pick a plan;
        // existing users with a workspace go straight to the dashboard.
        window.location.assign(await firstLoginTarget(supabase, signInData?.user?.id ?? ''))
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleProvider(provider: 'google' | 'azure') {
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

  // Decide where a signed-in user should land: existing users -> dashboard,
  // brand-new users (no workspace yet) -> /pricing to choose a plan.
  async function firstLoginTarget(
    supabase: ReturnType<typeof createClient>,
    userId: string,
  ): Promise<string> {
    if (!userId) return redirectTo
    const { data } = await supabase.from('organizations').select('id').limit(1)
    if (data && data.length > 0) return redirectTo
    return '/pricing'
  }

  // Handle email confirmation hash: /auth/v1/verify lands on the site with the token in the URL.
  // When the user follows the confirm link, exchange the hash and redirect.
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
    <main className="min-h-screen grid-bg px-5 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <Brand />
        <div className="card mt-8 rounded-3xl p-7 sm:p-8">
          <p className="text-sm text-[#d8b45a]">{mode === 'login' ? 'Welcome back' : 'Start your journey'}</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">{mode === 'login' ? 'Sign in to DropVerse' : 'Create your account'}</h1>
          <p className="mt-3 text-sm leading-6 text-[#8fa29c]">Access services, work samples and the tools you need to build your Drop Servicing business.</p>

          <div className="mt-7 grid gap-3">
            <ProviderButton
              provider="google"
              label="Google"
              loading={providerLoading === 'google'}
              onClick={() => handleProvider('google')}
              logo={
                <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              }
            />
            <ProviderButton
              provider="azure"
              label="Microsoft"
              loading={providerLoading === 'azure'}
              onClick={() => handleProvider('azure')}
              logo={
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#F25022" d="M1 1h10.5v10.5H1z"/><path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z"/><path fill="#00A4EF" d="M1 12.5h10.5V23H1z"/><path fill="#FFB900" d="M12.5 12.5H23V23H12.5z"/></svg>
              }
            />
          </div>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[.16em] text-[#718781]"><span className="h-px flex-1 bg-white/10" />or email<span className="h-px flex-1 bg-white/10" /></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && <>
              <label className="block text-sm font-medium text-[#d9e0dc]">Full name<input name="full_name" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" type="text" placeholder="Your full name" required autoComplete="name" /></label>
              <label className="block text-sm font-medium text-[#d9e0dc]">Mobile number <span className="text-xs font-normal text-[#9aaca6]">(must work on WhatsApp or Telegram)</span><CountryPhoneField /></label>
              <label className="block text-sm font-medium text-[#d9e0dc]">Username<input name="username" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" type="text" placeholder="Pick a username" required minLength={3} autoComplete="username" /></label>
              <label className="block text-sm font-medium text-[#d9e0dc]">Telegram username <span className="text-xs font-normal text-[#9aaca6]">(optional)</span><input name="telegram_username" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" type="text" placeholder="@username" autoComplete="nickname" /></label>
              <label className="block text-sm font-medium text-[#d9e0dc]">Referral code <span className="text-xs font-normal text-[#9aaca6]">(optional — from a friend's invite link)</span><input name="referral_code" id="referral_code" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 uppercase outline-none focus:border-[rgba(216,180,90,0.50)]" type="text" placeholder="DV-XXXXXXXX" maxLength={12} autoComplete="off" defaultValue={referralPrefill} /></label>
            </>}
            <label className="block text-sm font-medium text-[#d9e0dc]">Email address<input name="email" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" type="email" placeholder="you@example.com" required autoComplete="email" /></label>
            <label className="block text-sm font-medium text-[#d9e0dc]">Password<input name="password" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" type="password" placeholder="At least 8 characters" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {message && <p className="rounded-lg border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.10)] px-4 py-2.5 text-sm text-[#f0d98b]">{message}</p>}
            {error && <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200">{error}</p>}
            <button disabled={loading || Boolean(providerLoading)} className="w-full rounded-xl bg-[#d8b45a] px-5 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-60">{loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
          </form>
          {mode === 'signup' && <p className="mt-4 text-xs leading-5 text-[#81948e]">Please make sure your phone number works on WhatsApp or Telegram so we can contact you when needed.</p>}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null) }} className="mt-5 w-full text-sm text-[#9aaca6] hover:text-[#f0d98b]">{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}</button>
          <Link href="/" className="mt-5 block text-center text-xs text-[#718781] hover:text-[#d8b45a]">Back to home</Link>
        </div>
      </div>
    </main>
  )
}

function CountryPhoneField() {
  const [country, setCountry] = useState<Country>(() => {
    const lang = typeof navigator !== 'undefined' ? navigator.language : 'en'
    const cc = lang.split('-').pop()?.toUpperCase() || 'US'
    return COUNTRIES.find(c => c.iso2 === cc) || COUNTRIES.find(c => c.iso2 === 'US')!
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
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.iso2.toLowerCase().includes(q) ||
      c.dialCode.includes(q.replace(/\+/, ''))
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
          onClick={() => setOpen(o => !o)}
          className="flex h-full w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-3.5 text-sm outline-none focus:border-[rgba(216,180,90,0.50)]"
          aria-label="Choose country code"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="font-semibold text-[#d9e0dc]">{country.iso2}</span>
          <span className="text-[#9aaca6]">{country.dialCode}</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-4 w-4 text-[#718781]" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.09 1.03l-4.25 4.5a.75.75 0 01-1.09 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-40 mt-1 w-[16rem] overflow-hidden rounded-xl border border-white/10 bg-[#122521] shadow-xl">
            <div className="border-b border-white/10 p-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search country or code..."
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[rgba(216,180,90,0.50)]"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {filtered.length === 0 && <li className="px-3 py-2 text-xs text-[#718781]">No country found</li>}
              {filtered.map(c => (
                <li key={`${c.iso2}-${c.dialCode}-${c.name}`}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/10 ${c.iso2 === country.iso2 ? 'bg-[rgba(216,180,90,0.12)] text-[#f0d98b]' : 'text-[#d9e0dc]'}`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="w-8 font-semibold">{c.iso2}</span>
                    <span className="w-12 text-[#9aaca6]">{c.dialCode}</span>
                    <span className="flex-1 truncate text-left">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <input
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
        type="tel"
        inputMode="tel"
        placeholder="555 123 4567"
        required
        value={number}
        onChange={e => setNumber(e.target.value)}
      />
      <input type="hidden" name="phone" value={`${country.dialCode} ${number.trim()}`} />
    </div>
  )
}
