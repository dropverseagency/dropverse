'use client'
import Link from 'next/link'
import { ArrowRight, Check, Zap, Users, Target } from 'lucide-react'
import { PLAN_CONFIG, membersLabelFor } from '../../lib/planConfig'
import SiteHeader from '../../components/SiteHeader'
import Brand from '../../components/Brand'
import { useAuth } from '../../lib/useAuth'
import DodoPlanCheckout from '../../components/DodoPlanCheckout'

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
          </p>
        </div>

      {/* Cards */}
      <section className="container pb-24">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: .12 }} variants={{ hidden: {}, show: { transition: { staggerChildren: .08 } } }} className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {PLAN_CONFIG.map((plan) => (
            <motion.div
              variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: .55, ease: luxuryEase } } }}
              whileHover={reduceMotion ? undefined : { y: -6, transition: { duration: .22, ease: luxuryEase } }}
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-7 transition duration-300 ${
                plan.highlight
                  ? 'border-[rgba(216,180,90,0.55)] bg-gradient-to-b from-[rgba(216,180,90,0.12)] to-[rgba(216,180,90,0.03)] shadow-[0_0_60px_rgba(216,180,90,0.12)]'
                  : 'card hover:border-[rgba(216,180,90,0.40)]'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#d8b45a] px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-[#10221f]">
                  Most Popular
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#6e817c]">{plan.displayName} Plan</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold">{priceFor(plan)}</span>
                {!plan.enterprise && <span className="text-sm text-[#849792]">/{perMonth(plan)}</span>}
              </div>
              <p className="mt-3 text-sm font-semibold text-[#b9c6c1]">{membersLabelFor(plan)}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm leading-6 text-[#c5d2cc]">
                    <Check size={16} className="mt-1 shrink-0 text-[#d8b45a]" /> {f}
                  </li>
                ))}
              </ul>
              {plan.enterprise ? (
                <a
                  href="mailto:dropverseagency@gmail.com?subject=Enterprise%20Inquiry"
                  className="mt-8 flex items-center justify-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-6 py-3.5 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]"
                >
                  Contact Sales <ArrowRight size={16} />
                </a>
              ) : signedIn && plan.price > 0 ? (
                <DodoPlanCheckout
                  planId={plan.id}
                  label={`Choose ${plan.displayName}`}
                  className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    plan.highlight
                      ? 'bg-[#d8b45a] text-[#10221f] hover:bg-[#f0d98b]'
                      : 'border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] text-[#e4c979] hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]'
                  }`}
                />
              ) : (
                <Link
                  href={planHref(signedIn, plan.id)}
                  className={`mt-8 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition ${
                    plan.highlight
                      ? 'bg-[#d8b45a] text-[#10221f] hover:bg-[#f0d98b]'
                      : 'border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] text-[#e4c979] hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]'
                  }`}
                >
                  {signedIn ? `Choose ${plan.displayName}` : plan.cta} <ArrowRight size={16} />
                </Link>
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Comparison table */}
      <section className="border-y border-[rgba(216,180,90,0.10)] bg-[#0a2926] py-20">
        <div className="container">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Compare everything.</h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-3 pr-4 font-semibold text-[#849792]">Feature</th>
                  {PLAN_CONFIG.map((p) => (
                    <th key={p.id} className={`px-4 py-3 font-bold ${p.highlight ? 'text-[#d8b45a]' : 'text-[#c1cbc7]'}`}>
                      {p.displayName}
                      {p.highlight ? ' ★' : ''}
                    </th>
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
