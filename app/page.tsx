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
              <Sparkles size={13} /> Digital business platform
            </motion.div>
            <motion.h1 variants={reveal} className="font-display text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-[2.75rem] lg:text-[3.15rem]">
              Build your digital business.{' '}
              <span className="gold-gradient">Find your next opportunity.</span>
            </motion.h1>
            <motion.p variants={reveal} className="mt-6 max-w-xl text-base leading-7 text-[#e2e8f0] sm:text-lg">
              Explore digital services, lead packs, and work samples in one platform built to help you turn opportunities into action. Nothing here is a guarantee of income or clients.
            </motion.p>
            <motion.div variants={reveal} className="mt-8 flex flex-wrap gap-3">
              <a href="#markets" className="brand-button-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold">
                Explore opportunities
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </a>
              <a href="#services" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white transition hover:border-[rgba(226,182,86,0.4)]">
                Explore services <ChevronRight size={17} />
              </a>
            </motion.div>
            <motion.div variants={reveal} className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-[#e2e8f0]/90">
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Centralized workspaces</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Service catalog</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Agency storefronts</span>
            </motion.div>
          </motion.div>

          <motion.div variants={reveal} initial={reduceMotion ? false : 'hidden'} animate="show" className="relative hidden lg:block">
            <div className="glow float-slow rounded-3xl border border-[rgba(226,182,86,0.18)] bg-[#101c19] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e2b656]">Project board</p>
                <span className="rounded-full bg-[rgba(226,182,86,0.12)] px-2.5 py-1 text-[10px] font-semibold text-[#e2b656]">Example</span>
              </div>
              <div className="space-y-3">
                {[['Video edit — product launch', 'In progress', '48h'], ['Brand kit refresh', 'In review', '3d'], ['Landing page — SaaS', 'Ready', '5d']].map(([title, status, eta]) => (
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

      <section id="markets" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <p className="eyebrow">Markets and opportunities</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Where people use DropVerse</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#e2e8f0]/75">
            These are published market estimates for context. They are not DropVerse revenue, market share, or a forecast of what you will earn.
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

      <section id="about" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <p className="eyebrow">Platform tools</p>
          <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">Everything digital teams need in one workspace</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={<Users size={18} />} title="Team collaboration" text="Shared workspaces, roles, and client-ready project views." />
            <Feature icon={<Layers size={18} />} title="Workflow templates" text="Reusable delivery systems for recurring digital services." />
            <Feature icon={<Zap size={18} />} title="Scale your workspace" text="Grow from solo operator to agency without switching tools." />
            <Feature icon={<Globe size={18} />} title="One platform" text="Catalog, orders, samples, and agency pages — connected." />
          </div>
        </div>
      </section>

      <section id="how" className="section-pad">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">From sample to sale in four steps</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/5 md:grid-cols-4">
            {[['01', 'Pick a sample', 'Browse proven service formats you can sell.'], ['02', 'Pitch the client', 'Share the sample, price, and turnaround with confidence.'], ['03', 'Fulfill the work', 'Run the project in DropVerse with clear status and assets.'], ['04', 'Keep the margin', 'You sell. DropVerse helps you deliver and scale.']].map(([n, t, d]) => (
              <div key={n} className="bg-[#101c19] p-7">
                <div className="text-sm font-bold text-[#e2b656]">{n}</div>
                <h3 className="font-display mt-10 text-xl font-bold">{t}</h3>
                <p className="mt-3 text-sm leading-6 text-[#e2e8f0]/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="samples" className="section-pad border-t border-white/5">
        <div className="container">
          <p className="eyebrow">Work samples</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Featured samples</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#e2e8f0]/70">
            Only samples marked featured in the catalog. If none are published, nothing is shown as inventory.
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

      <section id="services" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Services</p>
              <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Built to sell</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#e2e8f0]/70">
                Content and creative delivery, web and brand work, and writing — only the services published in the catalog. The freelance-platform market above is not the market size for any one of these.
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

      <section id="start" className="section-pad border-t border-white/5">
        <div className="container text-center">
          <p className="eyebrow">Get started</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to link talent to sales?</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#e2e8f0]/75">
            Open a workspace, pitch proven samples, and keep the margin.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={signedIn ? '/dashboard' : '/login'} className="brand-button-primary rounded-full px-6 py-3.5 text-sm font-bold">
              {signedIn ? 'Open dashboard' : 'Create account'}
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
