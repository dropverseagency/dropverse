'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Users, Wallet, Share2, TrendingUp, Timer, Crown, Percent } from 'lucide-react'
import Brand from '../../components/Brand'
import SiteHeader from '../../components/SiteHeader'
import { useAuth } from '../../lib/useAuth'
import { REFERRAL_TIERS, REFERRAL_ELIGIBILITY_MONTHS } from '../../lib/referralConfig'

/** Founding / lifetime partner window closes at start of 2027 (UTC). */
const LIFETIME_DEADLINE = new Date('2027-01-01T00:00:00.000Z')

type Remain = { days: number; hours: number; minutes: number; seconds: number; expired: boolean }

function remainingUntil(deadline: Date, now: Date): Remain {
  const ms = deadline.getTime() - now.getTime()
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  const sec = Math.floor(ms / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return { days, hours, minutes, seconds, expired: false }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function LifetimeCountdown() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const r = useMemo(() => remainingUntil(LIFETIME_DEADLINE, now), [now])

  if (r.expired) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0a2926] p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#8fa29c]">
          <Timer size={22} />
        </div>
        <p className="mt-4 text-sm font-semibold text-[#c5d0cb]">Lifetime partner window closed</p>
        <p className="mt-2 text-sm text-[#849792]">
          New partners still earn tiered commissions. Lifetime status was only available until 1 Jan 2027.
        </p>
      </div>
    )
  }

  const units: [string, number][] = [
    ['Days', r.days],
    ['Hours', r.hours],
    ['Min', r.minutes],
    ['Sec', r.seconds],
  ]

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[rgba(216,180,90,0.35)] bg-gradient-to-br from-[#1a2f1c] via-[#0b2a26] to-[#071f1d] p-6 sm:p-8">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[rgba(216,180,90,0.12)] blur-2xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.4)] bg-[rgba(216,180,90,0.12)] text-[#d8b45a]">
            <Timer size={22} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.1)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#e4c979]">
              <Crown size={12} /> Lifetime Partner offer
            </div>
            <h3 className="font-display mt-3 text-xl font-extrabold text-white sm:text-2xl">
              Become a lifetime partner before 1 Jan 2027
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#a8b8b2]">
              Join during this window and lock <span className="font-semibold text-[#e4c979]">lifetime partner status</span> —
              your tier benefits stay with you as long as you stay active in the program.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {units.map(([label, value]) => (
            <div
              key={label}
              className="min-w-[4.25rem] rounded-2xl border border-white/10 bg-[#071f1d]/80 px-2 py-3 text-center backdrop-blur"
            >
              <div className="font-display text-xl font-extrabold tabular-nums text-[#f0d98b] sm:text-2xl">
                {label === 'Days' ? value : pad(value)}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#7f918c]">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function EarnPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

  return (
    <main className="min-h-screen bg-[#071f1d]">
      <SiteHeader />

      <section className="container pb-20 pt-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Partner program</p>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Become a Partner
          </h1>
          <p className="mt-5 text-[#8fa29c]">
            Share DropVerse, refer digital teams, and earn commissions when they grow their workspace.
            Rates scale with your active referrals — up to 25%.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={signedIn ? '/dashboard/affiliate' : '/login'}
              className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
            >
              {signedIn ? 'Open affiliate dashboard' : 'Get started'} <ArrowRight size={18} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-7 py-3.5 font-semibold text-white transition hover:border-[rgba(216,180,90,0.40)]"
            >
              View plans
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <LifetimeCountdown />
        </div>

        <div className="mx-auto mt-14 max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
              <Percent size={18} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Commission tiers</h2>
              <p className="text-sm text-[#849792]">
                Based on active referrals. Eligibility window: {REFERRAL_ELIGIBILITY_MONTHS} months per referred workspace.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REFERRAL_TIERS.map((tier) => {
              const range =
                tier.max === Infinity
                  ? `${tier.min}+ referrals`
                  : tier.min === tier.max
                    ? `${tier.min} referral`
                    : `${tier.min}–${tier.max} referrals`
              const highlight = tier.name === 'PARTNER'
              return (
                <div
                  key={tier.name}
                  className={`rounded-2xl border p-5 ${
                    highlight
                      ? 'border-[rgba(216,180,90,0.4)] bg-[rgba(216,180,90,0.08)]'
                      : 'border-white/5 bg-[#0a2926]'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d8b45a]">{tier.name}</p>
                  <p className="font-display mt-3 text-3xl font-extrabold text-white">{tier.ratePct}%</p>
                  <p className="mt-2 text-sm text-[#849792]">{range}</p>
                  <p className="mt-3 text-xs leading-5 text-[#6f837d]">
                    of eligible DropVerse revenue (client price − fulfillment cost)
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Share2, 'Share your link', 'Get a unique referral link from your dashboard.'],
            [Users, 'Invite teams', 'Digital agencies and freelancers join through you.'],
            [TrendingUp, 'They grow', 'When referred workspaces upgrade, you earn.'],
            [Wallet, 'Get paid', 'Track commissions and request payouts anytime.'],
          ].map(([Icon, title, text]) => (
            <div key={title as string} className="rounded-2xl border border-white/5 bg-[#0a2926] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
                <Icon size={18} />
              </div>
              <h3 className="font-display mt-4 text-base font-bold">{title as string}</h3>
              <p className="mt-2 text-sm text-[#849792]">{text as string}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Brand compact />
          <div className="flex flex-wrap gap-6 text-sm text-[#83958f]">
            <Link href="/" className="hover:text-[#d8b45a]">Home</Link>
            <Link href="/leads" className="hover:text-[#d8b45a]">Lead Marketplace</Link>
            <Link href="/earn" className="hover:text-[#d8b45a]">Become a Partner</Link>
            <Link href="/pricing" className="hover:text-[#d8b45a]">Pricing</Link>
            <Link href="/privacy" className="hover:text-[#d8b45a]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#d8b45a]">Terms</Link>
          </div>
          <p className="text-sm text-[#667c75]">© {new Date().getFullYear()} DropVerse</p>
        </div>
      </footer>
    </main>
  )
}
