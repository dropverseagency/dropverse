'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Sparkles,
  Users,
  Zap,
  Globe,
  Layers,
  Clock,
  Building2,
  Briefcase,
  Package,
} from 'lucide-react'
import { useAuth } from '../lib/useAuth'
import Brand from '../components/Brand'
import SiteHeader from '../components/SiteHeader'
import { MARKET_FACTS } from '../lib/marketFacts'
import { MarketCite } from '../components/MarketCite'

const fallbackServices = [
  ['Video Editing', 'Reels, TikTok, Shorts, ads & long-form content.'],
  ['Graphic Design', 'Branding, social creatives, ads & marketing assets.'],
  ['Web Design', 'Modern landing pages, stores and conversion-focused websites.'],
  ['Social Media Content', 'Content systems built to keep brands consistent.'],
  ['UGC Content', 'Authentic creator content designed to drive action.'],
  ['Copywriting', 'Hooks, scripts, landing pages and sales copy.'],
  ['Branding', 'Visual identities that make businesses memorable.'],
  ['Motion Graphics', 'Animated visuals, promos and high-impact content.'],
]

const luxuryEase = [0.23, 1, 0.32, 1] as const
const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: luxuryEase } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.075 } } }
const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: luxuryEase } },
}

type SampleCard = { id: string; title: string; description?: string | null; thumbnail_url?: string | null }

const PATHS = [
  {
    icon: Building2,
    title: 'Agencies',
    text: 'Run client delivery from one workspace — samples, orders, and team roles without switching tools.',
    href: '/pricing',
    cta: 'See plans',
  },
  {
    icon: Briefcase,
    title: 'Solo operators',
    text: 'Sell digital services with proven sample formats, then fulfill and track projects in DropVerse.',
    href: '/#services',
    cta: 'Browse services',
  },
  {
    icon: Package,
    title: 'Lead sellers & buyers',
    text: 'List or purchase lead packs by niche and country. Login required to sell or buy.',
    href: '/leads',
    cta: 'Open marketplace',
  },
]

export default function Home() {
  const [liveServices, setLiveServices] = useState<[string, string][] | null>(null)
  const [samples, setSamples] = useState<SampleCard[]>([])
  const auth = useAuth()
  const services = liveServices ?? fallbackServices
  const signedIn = !auth.loading && Boolean(auth.user)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/catalog')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (Array.isArray(j.services) && j.services.length) {
          setLiveServices(j.services.map((s: { title: string; description?: string }) => [s.title, s.description || 'Published service']))
        }
        if (Array.isArray(j.samples)) setSamples(j.samples)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="overflow-hidden bg-[#061916] text-white">
      <SiteHeader />

      <section className="grid-bg relative flex min-h-[88vh] items-center pt-20">
        <div className="absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[rgba(226,182,86,0.06)] blur-[100px]" />
        <div className="container relative grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={reveal} initial={reduceMotion ? false : 'hidden'} animate="show">
            <motion.div variants={reveal} className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(226,182,86,0.25)] bg-[rgba(226,182,86,0.08)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#e2b656]">
              <Sparkles size={13} /> Online business & agency platform
            </motion.div>
            <motion.h1 variants={reveal} className="font-display text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-[2.75rem] lg:text-[3.15rem]">
              Build your online business & agency{' '}
              <span className="gold-gradient">with DropVerse.</span>
            </motion.h1>
            <motion.p variants={reveal} className="mt-6 max-w-xl text-base leading-7 text-[#e2e8f0] sm:text-lg">
              One platform to sell digital services, pitch work samples, run client projects, and trade lead packs — built for agencies and operators who want structure without guaranteed outcomes.
            </motion.p>
            <motion.div variants={reveal} className="mt-8 flex flex-wrap gap-3">
              <Link href={signedIn ? '/dashboard' : '/login'} className="brand-button-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold">
                {signedIn ? 'Open dashboard' : 'Start building'}
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#paths" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white transition hover:border-[rgba(226,182,86,0.4)]">
                See how it fits you <ChevronRight size={17} />
              </a>
            </motion.div>
            <motion.div variants={reveal} className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-[#e2e8f0]/90">
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Agency workspaces</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Service catalog & samples</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Lead marketplace</span>
            </motion.div>
          </motion.div>

          <motion.div variants={reveal} initial={reduceMotion ? false : 'hidden'} animate="show" className="relative hidden lg:block">
            <div className="glow float-slow rounded-3xl border border-[rgba(226,182,86,0.18)] bg-[#101c19] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e2b656]">Agency board</p>
                <span className="rounded-full bg-[rgba(226,182,86,0.12)] px-2.5 py-1 text-[10px] font-semibold text-[#e2b656]">Example</span>
              </div>
              <div className="space-y-3">
                {[['Client video pack — launch', 'In progress', '48h'], ['Brand kit for agency pitch', 'In review', '3d'], ['Landing page delivery', 'Ready', '5d']].map(([title, status, eta]) => (
                  <div key={title} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#061916]/70 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-xs text-[#e2e8f0]/70">{status}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#e2e8f0]">
                      <Clock size={11} /> {eta}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-5 text-[#9aa8a3]">
                Illustration only. These rows are sample copy, not live DropVerse projects, clients, or performance data.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="paths" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <p className="eyebrow">Who DropVerse is for</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            One platform, three clear paths
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#e2e8f0]/75">
            Pick the path that matches how you work. You can use more than one — nothing here promises clients or income.
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {PATHS.map(({ icon: Icon, title, text, href, cta }) => (
              <article key={title} className="flex flex-col rounded-3xl border border-white/10 bg-[#0c1916] p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(226,182,86,0.2)] bg-[rgba(226,182,86,0.08)] text-[#e2b656]">
                  <Icon size={20} />
                </div>
                <h3 className="font-display text-xl font-bold">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-[#e2e8f0]/75">{text}</p>
                <Link href={href} className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#e2b656]">
                  {cta} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <p className="eyebrow">Platform</p>
          <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">What you get inside DropVerse</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={<Users size={18} />} title="Team collaboration" text="Shared workspaces, roles, and client-ready project views." />
            <Feature icon={<Layers size={18} />} title="Delivery systems" text="Reusable flows for recurring digital services." />
            <Feature icon={<Zap size={18} />} title="Grow without switching" text="From solo operator to agency in the same product." />
            <Feature icon={<Globe size={18} />} title="One platform" text="Services, samples, orders, and lead packs in one place." />
          </div>
        </div>
      </section>

      <section id="how" className="section-pad">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">From offer to delivery in four steps</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/5 md:grid-cols-4">
            {[['01', 'Set up your workspace', 'Create an account and organize services, samples, or lead packs.'], ['02', 'Pitch with proof', 'Share work samples and clear scope when you talk to clients.'], ['03', 'Deliver in one place', 'Track projects, status, and assets without tool-hopping.'], ['04', 'Scale your agency', 'Add team roles, plans, and partner referrals as you grow.']].map(([n, t, d]) => (
              <div key={n} className="bg-[#101c19] p-7">
                <div className="text-sm font-bold text-[#e2b656]">{n}</div>
                <h3 className="font-display mt-10 text-xl font-bold">{t}</h3>
                <p className="mt-3 text-sm leading-6 text-[#e2e8f0]/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Services</p>
              <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Digital services you can sell</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#e2e8f0]/70">
                Content, creative, web, and brand work — only what is published in the catalog.
              </p>
            </div>
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-bold text-[#e2b656]">View plans <ArrowRight size={16} /></Link>
          </div>
          <motion.div variants={stagger} initial={reduceMotion ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.12 }} className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(([title, text], i) => (
              <motion.div key={title + String(i)} variants={staggerItem} className="bento-card group p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#e2e8f0]/50">0{i + 1}</span>
                  <ArrowRight size={16} className="text-[#e2e8f0]/40 transition group-hover:translate-x-1 group-hover:text-[#e2b656]" />
                </div>
                <h3 className="font-display mt-8 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#e2e8f0]/75">{text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="samples" className="section-pad border-t border-white/5">
        <div className="container">
          <p className="eyebrow">Work samples</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Pitch with real samples</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#e2e8f0]/70">
            Featured catalog entries only. Empty means nothing is published yet — we do not invent portfolio items.
          </p>
          {samples.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-white/15 px-6 py-10 text-sm text-[#9aa8a3]">
              No featured samples are published yet.
            </p>
          ) : (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {samples.map((sample) => (
                <li key={sample.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#101c19]">
                  {sample.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sample.thumbnail_url} alt="" className="h-40 w-full object-cover" />
                  ) : null}
                  <div className="p-5">
                    <h3 className="font-display text-lg font-bold">{sample.title}</h3>
                    {sample.description ? <p className="mt-2 text-sm leading-6 text-[#e2e8f0]/75">{sample.description}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="markets" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <p className="eyebrow">Market context</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Why operators build online agencies</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#e2e8f0]/75">
            Published category estimates for orientation only — not DropVerse revenue, market share, or a forecast of what you will earn.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {MARKET_FACTS.map((fact) => (
              <article key={fact.id} className="flex flex-col rounded-3xl border border-white/10 bg-[#0c1916] p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e2b656]">{fact.title}</p>
                {fact.figure ? (
                  <p className="font-display mt-4 text-3xl font-extrabold text-white">{fact.figure}</p>
                ) : null}
                {fact.figureLabel ? <p className="mt-1 text-xs text-[#9aa8a3]">{fact.figureLabel}</p> : null}
                <p className="mt-4 flex-1 text-sm leading-6 text-[#e2e8f0]/80">{fact.body}</p>
                <MarketCite sourceName={fact.sourceName} sourceUrl={fact.sourceUrl} sourceDate={fact.sourceDate} scope={fact.scope} />
                <Link href={fact.href} className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#e2b656]">
                  {fact.cta} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="section-pad border-t border-white/5">
        <div className="container text-center">
          <p className="eyebrow">Get started</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Build your agency on DropVerse</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#e2e8f0]/75">
            Open a workspace, organize services and samples, and run delivery in one place.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={signedIn ? '/dashboard' : '/login'} className="brand-button-primary rounded-full px-6 py-3.5 text-sm font-bold">
              {signedIn ? 'Open dashboard' : 'Create account'}
            </Link>
            <Link href="/pricing" className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white hover:border-[rgba(226,182,86,0.4)]">
              Compare plans
            </Link>
            <Link href="/leads" className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white hover:border-[rgba(226,182,86,0.4)]">
              Lead Marketplace
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Brand compact />
          <div className="flex flex-wrap gap-6 text-sm text-[#83958f]">
            <Link href="/#services" className="hover:text-[#e2b656]">Services</Link>
            <Link href="/leads" className="hover:text-[#e2b656]">Leads</Link>
            <Link href="/earn" className="hover:text-[#e2b656]">Become a Partner</Link>
            <Link href="/pricing" className="hover:text-[#e2b656]">Pricing</Link>
            <Link href="/privacy" className="hover:text-[#e2b656]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#e2b656]">Terms</Link>
          </div>
          <p className="text-sm text-[#667c75]">© {new Date().getFullYear()} DropVerse</p>
        </div>
      </footer>
    </main>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="bento-card p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(226,182,86,0.2)] bg-[rgba(226,182,86,0.08)] text-[#e2b656]">{icon}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#e2e8f0]/75">{text}</p>
    </div>
  )
}
