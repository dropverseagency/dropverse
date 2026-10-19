'use client'
import Link from 'next/link'
import { ArrowRight, Check, Zap, Users, Target } from 'lucide-react'
import { PLAN_CONFIG, membersLabelFor } from '../../lib/planConfig'
import SiteHeader from '../../components/SiteHeader'
import Brand from '../../components/Brand'
import { useAuth } from '../../lib/useAuth'

function planHref(signedIn: boolean, planId: string): string {
  return signedIn ? `/dashboard?plan=${encodeURIComponent(planId)}` : '/login'
}

function priceFor(plan: (typeof PLAN_CONFIG)[number]): string {
  if (plan.enterprise) return 'Custom'
  return plan.price === 0 ? '$0' : `$${plan.price}`
}

export default function PricingPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

  return (
    <main className="min-h-screen bg-[#071f1d]">
      <SiteHeader highlightEarn={false} />

      <section className="container pb-20 pt-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Pricing</p>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Plans built for digital teams
          </h1>
          <p className="mt-5 text-[#8fa29c]">
            Start free, then scale with the workspace license that matches your team size and delivery volume.
            Prices below are the plans configured in DropVerse — not a share of any external market.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-4">
          {PLAN_CONFIG.map((plan) => {
            const featured = Boolean(plan.highlight) || plan.id === 'AGENCY'
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border p-6 ${
                  featured
                    ? 'border-[rgba(216,180,90,0.55)] bg-gradient-to-b from-[rgba(216,180,90,0.12)] to-[rgba(216,180,90,0.03)]'
                    : 'border-white/10 bg-[#0a2926]'
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#d8b45a] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#10221f]">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold text-[#e8efe9]">{plan.displayName}</span>
                </div>
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-display text-3xl font-extrabold text-[#e8efe9]">{priceFor(plan)}</span>
                  {!plan.enterprise && plan.price > 0 && (
                    <span className="mb-1 text-sm text-[#849792]">/mo</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-[#849792]">{membersLabelFor(plan)}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.slice(0, 8).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#c1cbc7]">
                      <Check size={14} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.enterprise ? 'mailto:dropverseagency@gmail.com' : planHref(signedIn, plan.id)}
                  className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition ${
                    featured
                      ? 'bg-[#d8b45a] text-[#10221f] hover:bg-[#f0d98b]'
                      : 'border border-[rgba(216,180,90,0.35)] text-[#e4c979] hover:bg-[rgba(216,180,90,0.12)]'
                  }`}
                >
                  {plan.enterprise ? 'Contact sales' : signedIn ? 'Choose plan' : 'Get started'}
                  <ArrowRight size={14} />
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0a2926] py-20">
        <div className="container text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">How agency pricing works</p>
          <h2 className="font-display mt-4 text-3xl font-extrabold sm:text-4xl">You sell. We fulfill. You keep the margin.</h2>
          <div className="mx-auto mt-12 flex flex-wrap items-center justify-center gap-4">
            {[
              [Target, 'Client order', 'You close the deal'],
              [Users, 'Workspace', 'Project created in DropVerse'],
              [Zap, 'Fulfillment', 'Our network delivers'],
            ].map(([Icon, title, sub]) => (
              <div key={title as string} className="flex flex-col items-center">
                <div className="flex w-48 flex-col items-center rounded-2xl border border-white/10 bg-[#071f1d] p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] text-[#d8b45a]">
                    <Icon size={18} />
                  </div>
                  <p className="font-display mt-3 text-sm font-bold">{title as string}</p>
                  <p className="mt-1 text-xs text-[#849792]">{sub as string}</p>
                </div>
              </div>
            ))}
            <div className="flex flex-col items-center">
              <div className="flex w-48 flex-col items-center rounded-2xl border border-[rgba(216,180,90,0.55)] bg-gradient-to-b from-[rgba(216,180,90,0.12)] to-[rgba(216,180,90,0.03)] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b45a] text-[#10221f]">
                  <span className="font-display text-sm font-extrabold">$</span>
                </div>
                <p className="font-display mt-3 text-sm font-bold text-[#e4c979]">Agency Revenue</p>
                <p className="mt-1 text-xs text-[#849792]">You keep the margin</p>
              </div>
            </div>
          </div>
          <Link href={planHref(signedIn, 'AGENCY')} className="mt-12 inline-flex items-center gap-3 rounded-full bg-[#d8b45a] px-7 py-4 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
            {signedIn ? 'Create your agency workspace' : 'Get started free'} <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="py-12">
        <div className="container flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Brand compact />
            <p className="mt-2 text-xs uppercase tracking-[.2em] text-[#6f827c]">B2B SaaS workflow management</p>
            <a href="mailto:dropverseagency@gmail.com" className="mt-2 block text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">dropverseagency@gmail.com</a>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[#80938d]">
            <a href="/#services">Platform Tools</a>
            <Link href="/earn">Earn</Link>
            <Link href="/pricing">Pricing</Link>
            <a href="mailto:dropverseagency@gmail.com">Contact</a>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/refund">Refund Policy</Link>
          </div>
          <p className="text-xs text-[#5f726c]">© 2026 DropVerse. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
