'use client'

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Brand from '../../components/Brand'
import ProviderButton from '../../components/ProviderButton'
import { createClient } from '../../lib/supabase'
import { COUNTRIES, type Country } from '../../lib/countries'
import { applyPendingReferral } from '../../lib/attributeReferralAction'
import { FreelancerDetails, validPortfolioLinks } from '../../components/FreelancerDetails'
import { saveFreelancerDetails } from '../../lib/saveFreelancerDetails'

/** Google shows unless NEXT_PUBLIC_GOOGLE_SIGN_IN=false. Apple stays off until configured. */
const GOOGLE_SIGN_IN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN !== 'false'
const APPLE_SIGN_IN_ENABLED = false

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
  const [freelancerSelected, setFreelancerSelected] = useState(false)
  const [freelancerNiches, setFreelancerNiches] = useState<string[]>([])
  const [otherNiche, setOtherNiche] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [providerLoading, setProviderLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(() => searchParams.get('error'))

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!key) return
    if (document.querySelector('script[data-turnstile]')) return
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true
    s.defer = true
    s.dataset.turnstile = '1'
    document.head.appendChild(s)
  }, [])

  async function firstLoginTarget(
    supabase: ReturnType<typeof createClient>,
    userId: string,
  ): Promise<string> {
    if (!userId) return redirectTo
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username, phone, user_type, user_types')
      .eq('id', userId)
      .maybeSingle()
    const hasType =
      Boolean(profile?.user_type) ||
      (Array.isArray(profile?.user_types) && profile.user_types.length > 0)
    const profileComplete = Boolean(
      profile?.full_name?.trim() && profile.full_name.trim().length >= 2 &&
      profile?.username?.trim() && profile.username.trim().length >= 3 &&
      profile?.phone?.replace(/\D/g, '').length >= 7,
    )
    if (!hasType || !profileComplete) return `/onboarding?redirect=${encodeURIComponent(redirectTo)}`
    if (profile?.user_type === 'freelancer' || profile?.user_types?.includes('freelancer')) {
      const { data: details } = await supabase.from('freelancer_profiles').select('niches').eq('user_id', userId).maybeSingle()
      const { data: links } = await supabase.from('freelancer_links').select('id').eq('user_id', userId).limit(1)
      if (!details?.niches?.length || !links?.length) return `/onboarding?redirect=${encodeURIComponent(redirectTo)}`
    }
    const { data } = await supabase.from('organizations').select('id').limit(1)
    if (data && data.length > 0) return redirectTo
    return '/pricing'
  }

  useEffect(() => {
    const oauth = searchParams.get('oauth') === '1'
    if (!oauth && typeof window !== 'undefined' && window.location.hash.length < 3) return

    const supabase = createClient()

    ;(async () => {
      if (typeof window !== 'undefined' && window.location.hash.length >= 3) {
        const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(window.location.hash)
        if (!exchErr && data.session) {
          applyPendingReferral().catch(() => undefined)
          await fetch('/api/notifications/welcome', { method: 'POST', credentials: 'include' }).catch(() => undefined)
          window.location.assign(await firstLoginTarget(supabase, data.session.user.id))
          return
        }
      }

      if (oauth) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user?.id) {
          applyPendingReferral().catch(() => undefined)
          await fetch('/api/notifications/welcome', { method: 'POST', credentials: 'include' }).catch(() => undefined)
          window.location.assign(await firstLoginTarget(supabase, session.user.id))
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectTo, searchParams])

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
        const retry = guardRes.headers.get('Retry-After') || '60'
        throw new Error(`Too many attempts. Please wait ${retry} seconds and try again.`)
      }
      if (!guardRes.ok) {
        const g = (await guardRes.json().catch(() => ({}))) as { message?: string }
        throw new Error(g.message || 'Security check failed. Please try again.')
      }

      if (mode === 'signup') {
        const fullName = String(form.get('full_name') || '').trim()
        const phone = String(form.get('phone') || '').trim()
        const username = String(form.get('username') || '').trim()
        if (fullName.length < 2) {
          throw new Error('Full name is required (at least 2 characters).')
        }
        if (phone.replace(/\D/g, '').length < 7) {
          throw new Error('Enter a valid mobile number.')
        }
        if (!username || username.length < 3) {
          throw new Error('Username is required (at least 3 characters).')
        }
        const allowedTypes = ['lead_generator', 'drop_servicer', 'freelancer'] as const
        const userTypes = form
          .getAll('user_types')
          .map((v) => String(v).trim())
          .filter((v) => (allowedTypes as readonly string[]).includes(v))
        if (userTypes.length === 0) {
          throw new Error('Please select at least one: Lead Generator, Drop Servicer, or Freelancer.')
        }
        const isFreelancer = userTypes.includes('freelancer')
        if (isFreelancer && !freelancerNiches.length) throw new Error('Select at least one niche.')
        if (isFreelancer && freelancerNiches.includes('Other') && !otherNiche.trim()) throw new Error('Please specify your other niche.')
        if (isFreelancer && !validPortfolioLinks(portfolioLinks)) throw new Error('Add valid portfolio links.')
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
            data: {
              full_name: fullName,
              phone,
              username,
              telegram_username: telegramUsername,
              user_types: userTypes,
              user_type: userTypes[0],
              ...(isFreelancer ? { freelancer_niche: freelancerNiches[0], freelancer_niches: freelancerNiches, freelancer_other_niche: otherNiche.trim(), freelancer_portfolio_links: portfolioLinks } : {}),
            },
            ...(turnstileToken ? { captchaToken: turnstileToken } : {}),
          },
        })
        if (signUpError) {
          const sMsg = signUpError.message || ''
          const sDetail = ((signUpError as { details?: string }).details || '').toLowerCase()
          if (
            sMsg.includes('already registered') ||
            sDetail.includes('duplicate') ||
            sMsg.includes('duplicate')
          ) {
            throw new Error(
              'This email is already registered — please sign in instead, or use a different email.',
            )
          }
          throw signUpError
        }
        applyPendingReferral().catch(() => undefined)
        if (data.session?.user?.id) {
          await supabase
            .from('profiles')
            .update({ full_name: fullName, phone, username: username.toLowerCase(), user_types: userTypes, user_type: userTypes[0] })
            .eq('id', data.session.user.id)
          if (isFreelancer) await saveFreelancerDetails(data.session.user.id, fullName, freelancerNiches, otherNiche, portfolioLinks)
          // Best-effort admin Telegram notify (Agent A sibling)
          void fetch('/api/agents/new-signup', { method: 'POST', credentials: 'include' }).catch(() => undefined)
          await fetch('/api/notifications/welcome', { method: 'POST', credentials: 'include' }).catch(() => undefined)
          window.location.assign(redirectTo)
        } else {
          setMessage(
            'Account created. Please open the confirmation email we sent to your inbox, then sign in.',
          )
        }
      } else {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
          email,
          password,
          ...(turnstileToken ? { options: { captchaToken: turnstileToken } } : {}),
        })
        if (signInError) throw signInError
        applyPendingReferral().catch(() => undefined)
        await fetch('/api/notifications/welcome', { method: 'POST', credentials: 'include' }).catch(() => undefined)
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
    const next = encodeURIComponent(redirectTo)
    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
    if (providerError) {
      setError(providerError.message)
      setProviderLoading(null)
    }
  }

  const showProviders = GOOGLE_SIGN_IN_ENABLED || APPLE_SIGN_IN_ENABLED

  return (
    <main className="min-h-screen grid-bg px-5 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <Brand />
        <div className="card mt-8 rounded-3xl p-7 sm:p-8">
          <p className="text-sm text-[#d8b45a]">{mode === 'login' ? 'Welcome back' : 'Start your journey'}</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">
            {mode === 'login' ? 'Sign in to DropVerse' : 'Create your account'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#8fa29c]">
            Access workflow tools, client management templates, and collaborative workspaces for digital
            teams.
          </p>

          {showProviders ? (
            <>
              <div className="mt-7 grid gap-3">
                {GOOGLE_SIGN_IN_ENABLED ? (
                  <ProviderButton
                    provider="google"
                    label="Google"
                    loading={providerLoading === 'google'}
                    onClick={() => handleProvider('google')}
                    logo={
                      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                    }
                  />
                ) : null}
              </div>
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[.16em] text-[#718781]">
                <span className="h-px flex-1 bg-white/10" />
                or email
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <label className="block text-sm font-medium text-[#d9e0dc]">
                  Full name
                  <input
                    name="full_name"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
                    type="text"
                    placeholder="Your full name"
                    required
                    autoComplete="name"
                  />
                </label>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-[#d9e0dc]">
                    I am a…{' '}
                    <span className="text-xs font-normal text-[#9aaca6]">(select all that apply)</span>
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      {
                        value: 'lead_generator',
                        label: 'Lead Generator',
                        desc: 'I generate & sell leads',
                      },
                      {
                        value: 'drop_servicer',
                        label: 'Drop Servicer',
                        desc: 'I sell services via freelancers',
                      },
                      {
                        value: 'freelancer',
                        label: 'Freelancer',
                        desc: 'I deliver the work myself',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 transition has-[:checked]:border-[rgba(216,180,90,0.55)] has-[:checked]:bg-[rgba(216,180,90,0.12)]"
                      >
                        <input type="checkbox" name="user_types" value={opt.value} className="sr-only" onChange={(e) => { if (opt.value === 'freelancer') setFreelancerSelected(e.target.checked) }} />
                        <span className="block text-sm font-semibold text-[#f0f4f2]">{opt.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-[#849792]">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {freelancerSelected && <FreelancerDetails niches={freelancerNiches} setNiches={setFreelancerNiches} otherNiche={otherNiche} setOtherNiche={setOtherNiche} links={portfolioLinks} setLinks={setPortfolioLinks} />}
                <label className="block text-sm font-medium text-[#d9e0dc]">
                  Mobile number{' '}
                  <span className="text-xs font-normal text-[#9aaca6]">(must work on WhatsApp or Telegram)</span>
                  <CountryPhoneField />
                </label>
                <label className="block text-sm font-medium text-[#d9e0dc]">
                  Username
                  <input
                    name="username"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
                    type="text"
                    placeholder="Pick a username"
                    required
                    minLength={3}
                    autoComplete="username"
                  />
                </label>
                <label className="block text-sm font-medium text-[#d9e0dc]">
                  Telegram username <span className="text-xs font-normal text-[#9aaca6]">(optional)</span>
                  <input
                    name="telegram_username"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
                    type="text"
                    placeholder="@username"
                    autoComplete="nickname"
                  />
                </label>
                <label className="block text-sm font-medium text-[#d9e0dc]">
                  Referral code{' '}
                  <span className="text-xs font-normal text-[#9aaca6]">(optional — from a friend\'s invite link)</span>
                  <input
                    name="referral_code"
                    id="referral_code"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 uppercase outline-none focus:border-[rgba(216,180,90,0.50)]"
                    type="text"
                    placeholder="DV-XXXXXXXX"
                    maxLength={12}
                    autoComplete="off"
                    defaultValue={referralPrefill}
                  />
                </label>
              </>
            )}
            <label className="block text-sm font-medium text-[#d9e0dc]">
              Email address
              <input
                name="email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </label>
            <label className="block text-sm font-medium text-[#d9e0dc]">
              Password
              <input
                name="password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
              <div
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                data-theme="dark"
              />
            ) : null}
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {message ? <p className="text-sm text-[#d8b45a]">{message}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-xl py-3.5 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#8fa29c]">
            {mode === 'login' ? (
              <>
                New here?{' '}
                <button type="button" className="font-semibold text-[#d8b45a]" onClick={() => setMode('signup')}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="font-semibold text-[#d8b45a]" onClick={() => setMode('login')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-[#718781]">
          <Link href="/" className="hover:text-[#d8b45a]">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}

function CountryPhoneField() {
  const [country, setCountry] = useState<Country>(COUNTRIES.find((c) => c.iso2 === 'EG') || COUNTRIES[0])
  const [number, setNumber] = useState('')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return COUNTRIES
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(s) || c.dialCode.includes(s) || c.iso2.toLowerCase().includes(s),
    )
  }, [q])
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div className="relative mt-2" ref={ref}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-3.5 text-sm"
        >
          <span>{country.flag}</span>
          <span className="text-[#d9e0dc]">{country.dialCode}</span>
        </button>
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]"
          type="tel"
          inputMode="tel"
          placeholder="1XXXXXXXXX"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ''))}
          required
          autoComplete="tel-national"
        />
      </div>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-white/10 bg-[#0a2926] p-2 shadow-xl">
          <input
            className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            placeholder="Search country…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {filtered.map((c) => (
            <button
              key={c.iso2}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10"
              onClick={() => {
                setCountry(c)
                setOpen(false)
                setQ('')
              }}
            >
              <span>{c.flag}</span>
              <span className="flex-1 text-[#d9e0dc]">{c.name}</span>
              <span className="text-[#849792]">{c.dialCode}</span>
            </button>
          ))}
        </div>
      ) : null}
      <input type="hidden" name="phone" value={`${country.dialCode} ${number.trim()}`} />
    </div>
  )
}
