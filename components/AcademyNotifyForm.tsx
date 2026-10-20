'use client'

import { useState } from 'react'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/useAuth'

export default function AcademyNotifyForm({ compact = false }: { compact?: boolean }) {
  const auth = useAuth()
  const sessionEmail = auth.user?.email ?? ''
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/academy/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || sessionEmail || undefined }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('err')
        setMessage(
          j.error === 'EMAIL_REQUIRED'
            ? 'Enter a valid email so we can notify you.'
            : 'Could not save. Try again in a moment.',
        )
        return
      }
      setStatus('ok')
      setMessage(j.message || 'You are on the list.')
      if (j.email) setEmail(j.email)
    } catch {
      setStatus('err')
      setMessage('Network error. Try again.')
    }
  }

  if (status === 'ok') {
    return (
      <div
        className={`flex items-start gap-2 rounded-2xl border border-[rgba(111,191,115,0.35)] bg-[rgba(111,191,115,0.1)] px-4 py-3 text-sm text-[#6fbf73] ${
          compact ? 'mt-5' : 'mt-4'
        }`}
      >
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={compact ? 'mt-5 space-y-3' : 'mt-4 space-y-3'}>
      {!sessionEmail ? (
        <input
          type="email"
          required
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-3.5 py-2.5 text-sm text-white placeholder:text-[#5f726c] outline-none focus:border-[rgba(216,180,90,0.45)]"
          autoComplete="email"
        />
      ) : (
        <p className="text-xs text-[#849792]">
          We will use <span className="font-semibold text-[#c5d0cb]">{sessionEmail}</span>
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'loading' || auth.loading}
        className="inline-flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.4)] bg-[rgba(216,180,90,0.12)] px-5 py-2.5 text-sm font-bold text-[#e4c979] transition hover:bg-[rgba(216,180,90,0.2)] disabled:opacity-50"
      >
        {status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
        {status === 'loading' ? 'Saving…' : 'Notify me'}
      </button>
      {status === 'err' && message ? <p className="text-xs text-red-300">{message}</p> : null}
      <p className="text-[11px] leading-4 text-[#5f726c]">No payment. We only email when Advanced Academy opens.</p>
    </form>
  )
}
