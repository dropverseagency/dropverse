import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, Star, Zap, Users, Target } from 'lucide-react'
import { PLAN_CONFIG, membersLabelFor } from '../../lib/planConfig'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Choose the DropVerse workspace that fits your business — Solo freelancers to full agencies.',
}

const ALL_FEATURES = [
  'Access DropVerse services',
  'Browse work samples',
  'Access freelancer marketplace',
  'Personal projects',
  'Client management',
  'Referral program',
  'Personal dashboard',
  'Agency workspace',
  'Team members',
  'Team management',
  'Shared clients',
  'Shared projects',
  'Team performance dashboard',
  'Agency referral tracking',
  'Shared work samples',
  'Basic analytics',
  'Advanced team permissions',
  'Advanced analytics',
  'Sales performance tracking',
  'Project assignment',
  'Team revenue analytics',
  'Priority support',
  'Advanced referral analytics',
  'Custom team limits',
  'Multiple workspaces',
  'Dedicated support',
  'Custom onboarding',
  'Custom integrations',
  'White-label infrastructure',
  'Custom billing',
]

function featureIn(planId: string, feature: string): boolean {
  const p = PLAN_CONFIG.find((x) => x.id === planId)
  if (!p) return false
  const list = p.features
  // "Everything in X" plans inherit all previous-plan features
  if (planId === 'AGENCY' && list.some((f) => f.startsWith('Everything in Solo')))
    return ALL_FEATURES.filter((f) => PLAN_CONFIG[0].features.includes(f)).includes(feature)
  if (planId === 'AGENCY_PRO' && list.some((f) => f.startsWith('Everything in Agency')))
    return ALL_FEATURES.filter((f) => PLAN_CONFIG[1].features.includes(f)).includes(feature)
  if (planId === 'ENTERPRISE' && list.some((f) => f.startsWith('Everything in Agency Pro')))
    return ALL_FEATURES.filter((f) => PLAN_CONFIG[2].features.includes(f)).includes(feature)
  return list.includes(feature)
}

function priceFor(plan: (typeof PLAN_CONFIG)[number]): string {
  if (plan.enterprise) return 'Custom'
  return plan.price === 0 ? '$0' : `$${plan.price}`
}

function perMonth(plan: (typeof PLAN_CONFIG)[number]): string {
  return plan.enterprise ? 'Tailored to your team' : plan.price === 0 ? 'Free forever' : 'per month'
}

export default function PricingPage() {
  return (
    <main className="overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="DropVerse home">
            <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover" priority />
            <span className="font-display text-xl font-extrabold tracking-[.16em]">
              DROP<span className="text-[#d8b45a]">VERSE</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-[#c1cbc7] lg:flex">
            <a href="/#services">Services</a>
            <Link href="/earn">Earn</Link>
            <span className="font-semibold text-[#e4c979]">Pricing</span>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Link href="/login" className="px-4 py-2 text-sm text-[#d9e0dc]">Login</Link>
            <Link href="/login" className="rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="grid-bg relative flex min-h-[55vh] items-center pt-20">
        <div className="absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]" />
        <div className="container relative py-24 text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Plans &amp; Pricing</p>
          <h1 className="font-display mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Choose the workspace that fits <span className="gold-gradient">your business.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[#95a7a1]">
            From solo sellers to full agencies — DropVerse scales with you. Start free and upgrade the moment your team grows.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="container pb-24">
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {PLAN_CONFIG.map((plan) => (
            <div
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
              ) : (
                <Link
                  href="/login"
                  className={`mt-8 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition ${
                    plan.highlight
                      ? 'bg-[#d8b45a] text-[#10221f] hover:bg-[#f0d98b]'
                      : 'border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] text-[#e4c979] hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]'
                  }`}
                >
                  {plan.cta} <ArrowRight size={16} />
                </Link>
              )}
            </div>
          ))}
        </div>
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
                </tr>
              </thead>
              <tbody>
                {ALL_FEATURES.map((f) => (
                  <tr key={f} className="border-t border-white/5">
                    <td className="py-3 pr-4 text-[#c5d2cc]">{f}</td>
                    {PLAN_CONFIG.map((p) => (
                      <td key={p.id} className="px-4 py-3">
                        {featureIn(p.id, f) ? <Check size={16} className="text-[#d8b45a]" /> : <span className="text-[#3d524c]">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Built for teams that sell */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]" />
        <div className="container relative text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">For teams</p>
          <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Built for teams that sell.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[#95a7a1]">
            Turn DropVerse into your agency&rsquo;s fulfillment engine. Your sales team brings clients, DropVerse delivers the work through professional freelancers — and you keep the margin.
          </p>
          <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center gap-0 sm:flex-row sm:justify-center">
            {[
              { icon: Users, title: 'Your Sales Team', sub: 'Pitch and close' },
              { icon: Zap, title: 'DropVerse Services', sub: 'Fulfillment engine' },
              { icon: Star, title: 'Professional Freelancers', sub: 'Deliver the work' },
              { icon: Target, title: 'Client Delivery', sub: 'On time, on brand' },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex flex-col items-center">
                <div className="card flex w-48 flex-col items-center rounded-2xl p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] text-[#d8b45a]">
                    <Icon size={18} />
                  </div>
                  <p className="font-display mt-3 text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-[#849792]">{sub}</p>
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
          <Link href="/login" className="mt-12 inline-flex items-center gap-3 rounded-full bg-[#d8b45a] px-7 py-4 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
            Create your agency workspace <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="py-12">
        <div className="container flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-3">
              <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover" />
              <div className="font-display text-xl font-extrabold tracking-[.16em]">DROP<span className="text-[#d8b45a]">VERSE</span></div>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[.2em] text-[#6f827c]">Linking talent to sales</p>
            <a href="mailto:dropverseagency@gmail.com" className="mt-2 block text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">dropverseagency@gmail.com</a>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[#80938d]">
            <a href="/#services">Services</a>
            <Link href="/earn">Earn</Link>
            <Link href="/pricing">Pricing</Link>
            <a href="mailto:dropverseagency@gmail.com">Contact</a>
          </div>
          <p className="text-xs text-[#5f726c]">© 2026 DropVerse. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
