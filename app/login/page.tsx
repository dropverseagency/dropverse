'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import Brand from '../../components/Brand'
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

  return (
    <main className="min-h-screen grid-bg px-5 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <Brand />
        <div className="card mt-8 rounded-3xl p-7 sm:p-8">
          <p className="text-sm text-[#d8b45a]">{mode === 'login' ? 'Welcome back' : 'Start your journey'}</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">{mode === 'login' ? 'Sign in to DropVerse' : 'Create your account'}</h1>
          <p className="mt-3 text-sm leading-6 text-[#8fa29c]">Access services, work samples and the tools you need to build your Drop Servicing business.</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => handleProvider('google')} disabled={Boolean(providerLoading)} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold transition hover:border-[rgba(216,180,90,0.50)] disabled:opacity-60">
              <span className="text-base font-bold text-[#d8b45a]">G</span>{providerLoading === 'google' ? 'Connecting...' : 'Google'}
            </button>
            <button type="button" onClick={() => handleProvider('azure')} disabled={Boolean(providerLoading)} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold transition hover:border-[rgba(216,180,90,0.50)] disabled:opacity-60">
              <span className="text-base font-bold text-[#d8b45a]">M</span>{providerLoading === 'azure' ? 'Connecting...' : 'Microsoft'}
            </button>
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
