'use client'

import { FormEvent, Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Brand from '../../components/Brand'
import { createClient } from '../../lib/supabase'

const OPTIONS = [
  { value: 'lead_generator', label: 'Lead Generator', desc: 'I generate and sell leads' },
  { value: 'drop_servicer', label: 'Drop Servicer', desc: 'I sell services via freelancers' },
  { value: 'freelancer', label: 'Freelancer', desc: 'I deliver the work myself' },
] as const

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}

function OnboardingInner() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const [userType, setUserType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!OPTIONS.some((o) => o.value === userType)) {
      setError('Please select one option.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.assign(`/login?redirect=${encodeURIComponent(redirectTo)}`)
        return
      }
      await supabase.auth.updateUser({ data: { user_type: userType } })
      const { error: upErr } = await supabase.from('profiles').update({ user_type: userType }).eq('id', user.id)
      if (upErr) throw upErr
      window.location.assign(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#071f1d] text-white">
      <div className="container flex min-h-screen flex-col items-center justify-center py-16">
        <Link href="/" className="mb-10"><Brand /></Link>
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a2926] p-7 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Almost done</p>
          <h1 className="font-display mt-2 text-2xl font-extrabold">How do you work?</h1>
          <p className="mt-2 text-sm text-[#8fa29c]">
            This helps us personalize DropVerse for you. You can change this later in settings.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            {OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  userType === opt.value
                    ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.12)]'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="user_type"
                  value={opt.value}
                  checked={userType === opt.value}
                  onChange={() => setUserType(opt.value)}
                  className="mt-1"
                  required
                />
                <span>
                  <span className="block font-semibold text-[#f0f4f2]">{opt.label}</span>
                  <span className="mt-0.5 block text-xs text-[#849792]">{opt.desc}</span>
                </span>
              </label>
            ))}
            {error ? (
              <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#d8b45a] px-5 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
