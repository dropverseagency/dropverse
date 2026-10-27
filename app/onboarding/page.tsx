'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Brand from '../../components/Brand'
import { createClient } from '../../lib/supabase'
import { FreelancerDetails, validPortfolioLinks } from '../../components/FreelancerDetails'
import { saveFreelancerDetails } from '../../lib/saveFreelancerDetails'

const OPTIONS = [
  { value: 'lead_generator', label: 'Lead Generator', desc: 'I generate and sell leads' },
  { value: 'drop_servicer', label: 'Drop Servicer', desc: 'I sell services via freelancers' },
  { value: 'freelancer', label: 'Freelancer', desc: 'I deliver the work myself' },
] as const

type UserTypeValue = (typeof OPTIONS)[number]['value']

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
  const [userTypes, setUserTypes] = useState<UserTypeValue[]>([])
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [freelancerNiches, setFreelancerNiches] = useState<string[]>([])
  const [otherNiche, setOtherNiche] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, username, user_type, user_types')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      setFullName(String(profile?.full_name || user.user_metadata?.full_name || ''))
      setPhone(String(profile?.phone || user.user_metadata?.phone || ''))
      setUsername(String(profile?.username || user.user_metadata?.username || ''))
      const roles = Array.isArray(profile?.user_types) && profile.user_types.length
        ? profile.user_types
        : profile?.user_type ? [profile.user_type] : []
      setUserTypes(roles.filter((role): role is UserTypeValue => OPTIONS.some((option) => option.value === role)))
      if (roles.includes('freelancer')) {
        const [{ data: details }, { data: links }] = await Promise.all([
          supabase.from('freelancer_profiles').select('niches, other_niche').eq('user_id', user.id).maybeSingle(),
          supabase.from('freelancer_links').select('url').eq('user_id', user.id),
        ])
        if (cancelled) return
        if (Array.isArray(details?.niches)) setFreelancerNiches(details.niches.map(String))
        if (details?.other_niche) setOtherNiche(String(details.other_niche))
        if (links?.length) setPortfolioLinks(links.map((link) => String(link.url)))
      }
    })()
    return () => { cancelled = true }
  }, [])

  function toggle(value: UserTypeValue) {
    setUserTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (userTypes.length === 0) {
      setError('Please select at least one option.')
      return
    }
    if (fullName.trim().length < 2) {
      setError('Enter your full name (at least 2 characters).')
      return
    }
    if (username.trim().length < 3) {
      setError('Enter a username with at least 3 characters.')
      return
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setError('Enter a valid mobile number.')
      return
    }
    if (userTypes.includes('freelancer') && (!freelancerNiches.length || (freelancerNiches.includes('Other') && !otherNiche.trim()) || !validPortfolioLinks(portfolioLinks))) {
      setError('Select your niches, specify Other if selected, and add valid portfolio links.')
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
      const cleanUsername = username.trim().toLowerCase()
      const { error: metaErr } = await supabase.auth.updateUser({ data: { full_name: fullName.trim(), phone: phone.trim(), username: cleanUsername, user_types: userTypes, user_type: userTypes[0], ...(userTypes.includes('freelancer') ? { freelancer_niche: freelancerNiches[0], freelancer_niches: freelancerNiches, freelancer_other_niche: otherNiche.trim(), freelancer_portfolio_links: portfolioLinks } : {}) } })
      if (metaErr) throw metaErr
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim(), username: cleanUsername, user_types: userTypes, user_type: userTypes[0] })
        .eq('id', user.id)
      if (upErr) throw upErr
      if (userTypes.includes('freelancer')) {
        await saveFreelancerDetails(user.id, fullName.trim(), freelancerNiches, otherNiche, portfolioLinks)
      }
      // Best-effort admin Telegram notify after role/niche selection
      void fetch('/api/agents/new-signup', { method: 'POST', credentials: 'include' }).catch(() => undefined)
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
            Select all that apply. This helps us personalize DropVerse for you.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <label className="block text-sm text-[#d9e0dc]">Full name
              <input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
            </label>
            <label className="block text-sm text-[#d9e0dc]">Mobile number
              <input required value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" placeholder="+20 100 000 0000" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
            </label>
            <label className="block text-sm text-[#d9e0dc]">Username
              <input required minLength={3} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
            </label>
            {OPTIONS.map((opt) => {
              const checked = userTypes.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                    checked
                      ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.12)]'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="user_types"
                    value={opt.value}
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-[#f0f4f2]">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-[#849792]">{opt.desc}</span>
                  </span>
                </label>
              )
            })}
            {userTypes.includes('freelancer') && <FreelancerDetails niches={freelancerNiches} setNiches={setFreelancerNiches} otherNiche={otherNiche} setOtherNiche={setOtherNiche} links={portfolioLinks} setLinks={setPortfolioLinks} />}
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
