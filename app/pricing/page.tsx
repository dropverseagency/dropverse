'use client'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, Star, Zap, Users, Target } from 'lucide-react'
import { PLAN_CONFIG, membersLabelFor } from '../../lib/planConfig'
import SiteHeader from '../../components/SiteHeader'
import Brand from '../../components/Brand'
import { useAuth } from '../../lib/useAuth'
import { ButtonLink, Card, SectionLabel } from '../../components/ui'

function planHref(signedIn: boolean, planId: string): string {
  return signedIn ? `/dashboard?plan=${encodeURIComponent(planId)}` : '/login'
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
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const reduceMotion = useReducedMotion()
  const luxuryEase = [0.23, 1, 0.32, 1] as const

  return (
    <main className="overflow-hidden bg-background text-foreground">
      <SiteHeader highlightEarn={false} />

      <section className="relative flex min-h-[50vh] items-center pt-20">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, ease: luxuryEase }}
          className="container relative py-20 text-center sm:py-24"
        >
          <SectionLabel>Plans & Pricing</SectionLabel>
          <h1 className="font-display mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            Choose the workspace that fits <span className="text-primary">your business.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
            From solo sellers to full agencies — DropVerse scales with you. Start free and upgrade the moment your team
            grows.
          </p>
        </motion.div>
      </section>

      <section className="container pb-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4"
        >
          {PLAN_CONFIG.map((plan) => (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: luxuryEase } },
              }}
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-7 ${
                plan.highlight
                  ? 'border-primary/50 bg-primary/10 shadow-card'
                  : 'border-border bg-card'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-primary-foreground">
                  Most Popular
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-[.2em] text-muted-foreground">
                {plan.displayName} Plan
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-foreground">{priceFor(plan)}</span>
                {!plan.enterprise && (
                  <span className="text-sm text-muted-foreground">/{perMonth(plan)}</span>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{membersLabelFor(plan)}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                    <Check size={16} className="mt-1 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              {plan.enterprise ? (
                <a
                  href="mailto:dropverseagency@gmail.com?subject=Enterprise%20Inquiry"
                  className="mt-8 flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-bold text-primary transition hover:bg-muted"
                >
                  Contact Sales <ArrowRight size={16} />
                </a>
              ) : (
                <Link
                  href={planHref(signedIn, plan.id)}
                  className={`mt-8 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition ${
                    plan.highlight
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'border border-border bg-card text-primary hover:bg-muted'
                  }`}
                >
                  {signedIn ? `Choose ${plan.displayName}` : plan.cta} <ArrowRight size={16} />
                </Link>
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="border-y border-border bg-card/60 py-20">
        <div className="container">
          <h2 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">Compare everything.</h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left">
                  <th className="py-3 pr-4 font-semibold text-muted-foreground">Feature</th>
                  {PLAN_CONFIG.map((p) => (
                    <th
                      key={p.id}
                      className={`px-4 py-3 font-bold ${p.highlight ? 'text-primary' : 'text-foreground'}`}
                    >
                      {p.displayName}
                      {p.highlight ? ' ★' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_FEATURES.map((f) => (
                  <tr key={f} className="border-t border-border">
                    <td className="py-3 pr-4 text-muted-foreground">{f}</td>
                    {PLAN_CONFIG.map((p) => (
                      <td key={p.id} className="px-4 py-3">
                        {featureIn(p.id, f) ? (
                          <Check size={16} className="text-primary" />
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container text-center">
          <SectionLabel>For teams</SectionLabel>
          <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Built for teams that sell.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
            Turn DropVerse into your agency&rsquo;s fulfillment engine. Your sales team brings clients, DropVerse
            delivers the work through professional freelancers — and you keep the margin.
          </p>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: 'Your Sales Team', sub: 'Pitch and close' },
              { icon: Zap, title: 'DropVerse Services', sub: 'Fulfillment engine' },
              { icon: Star, title: 'Professional Freelancers', sub: 'Deliver the work' },
              { icon: Target, title: 'Client Delivery', sub: 'On time, on brand' },
            ].map(({ icon: Icon, title, sub }) => (
              <Card key={title} className="flex flex-col items-center p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-primary">
                  <Icon size={18} />
                </div>
                <p className="font-display mt-3 text-sm font-bold text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
              </Card>
            ))}
          </div>
          <div className="mt-12">
            <ButtonLink href={planHref(signedIn, 'AGENCY')} size="lg">
              {signedIn ? 'Create your agency workspace' : 'Get started free'} <ArrowRight size={18} />
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12">
        <div className="container flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Brand />
            <p className="mt-2 text-xs uppercase tracking-[.2em] text-muted-foreground">Linking talent to sales</p>
            <a
              href="mailto:dropverseagency@gmail.com"
              className="mt-2 block text-sm font-semibold text-primary hover:opacity-80"
            >
              dropverseagency@gmail.com
            </a>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href="/#services" className="hover:text-foreground">
              Services
            </a>
            <Link href="/earn" className="hover:text-foreground">
              Earn
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <a href="mailto:dropverseagency@gmail.com" className="hover:text-foreground">
              Contact
            </a>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 DropVerse. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
