'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import Brand from '../../components/Brand'
import ProviderButton from '../../components/ProviderButton'
import { createClient } from '../../lib/supabase'

export default function LoginPage() {
  const [redirectTo] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') || '/dashboard' : '/dashboard')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
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
        const telegramUsername = String(form.get('telegram_username') || '').trim()

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: { full_name: fullName, phone, telegram_username: telegramUsername },
          },
        })
        if (signUpError) throw signUpError
        if (data.session) window.location.assign(redirectTo)
        else setMessage('تم إنشاء الحساب. افتح رسالة التأكيد التي أرسلناها إلى بريدك الإلكتروني ثم سجّل الدخول.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        window.location.assign(redirectTo)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'حدث خطأ أثناء تنفيذ العملية.')
    } finally {
      setLoading(false)
    }
  }

  async function handleProvider(provider: 'google' | 'azure' | 'apple') {
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
              provider="apple"
              label="Apple"
              loading={providerLoading === 'apple'}
              onClick={() => handleProvider('apple')}
              logo={
                <svg viewBox="0 0 170 170" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69.08-8.14-1.07-13.32-3.47-5.197-2.39-9.973-3.56-14.34-3.56-4.58 0-9.492 1.17-14.746 3.56-5.262 2.4-9.501 3.66-12.742 3.8-4.929.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.169-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.378 0-10.857 2.346-20.221 7.045-28.072 3.693-6.3 8.606-11.275 14.746-14.917 6.132-3.641 12.78-5.541 19.973-5.71 3.922-.08 9.06 1.21 15.427 3.86 6.35 2.65 10.408 3.98 12.164 3.98 1.344 0 5.877-1.56 13.57-4.67 7.275-2.94 13.405-4.20 18.405-3.85 13.63.44 23.87 5.33 30.68 14.7-12.19 7.38-18.22 17.71-18.11 30.97.106 10.32 3.86 18.88 11.23 25.65 3.35 3.15 7.08 5.6 11.22 7.37-.9 2.61-1.85 5.11-2.86 7.5zM119.11 7.24c0 8.102-2.96 15.67-8.86 22.67-7.12 8.324-15.73 13.134-25.07 12.383a25.226 25.226 0 0 1-.19-3.07c0-7.78 3.39-16.1 9.42-22.9 3.01-3.44 6.83-6.31 11.45-8.6 4.61-2.26 8.96-3.55 13.06-3.87.12 1.13.19 2.26.19 3.387z"/></svg>
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
              <label className="block text-sm font-medium text-[#d9e0dc]">Mobile number <span className="text-xs font-normal text-[#9aaca6]">(include your country code; must work on WhatsApp or Telegram)</span><input name="phone" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" type="tel" placeholder="e.g. +1 555 123 4567" inputMode="tel" pattern="^\\+?[0-9\\s().-]{7,}$" required autoComplete="tel" /></label>
              <label className="block text-sm font-medium text-[#d9e0dc]">Telegram username <span className="text-xs font-normal text-[#9aaca6]">(optional)</span><input name="telegram_username" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-[rgba(216,180,90,0.50)]" type="text" placeholder="@username" autoComplete="nickname" /></label>
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
