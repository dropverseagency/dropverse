'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ClipboardList, PackageCheck, Plus, Sparkles, Users } from 'lucide-react'
import SiteHeader from '../components/SiteHeader'
import Brand from '../components/Brand'
import { useAuth } from '../lib/useAuth'
import { MARKET_FACTS } from '../lib/marketFacts'
import { MarketCite } from '../components/MarketCite'
import HeroCtas from '../components/HeroCtas'
import './editorial.css'

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

const paths = [
  {
    title: 'Agencies',
    label: 'A place for your team.',
    text: 'Run client delivery from one workspace — samples, orders, and team roles without switching tools.',
    href: '/pricing',
    cta: 'Explore agency plans',
  },
  {
    title: 'Solo operators',
    label: 'Your next chapter.',
    text: 'Sell digital services with proven sample formats, then fulfill and track projects in DropVerse.',
    href: '/#services',
    cta: 'Find your service',
  },
  {
    title: 'Lead sellers & buyers',
    label: 'Make new connections.',
    text: 'List or purchase lead packs by niche and country. Sign in to buy or sell.',
    href: '/leads',
    cta: 'Explore the marketplace',
  },
]
const steps = [
  ['Set up your workspace', 'Create an account and organize services, samples, or lead packs.'],
  ['Pitch with proof', 'Share work samples and clear scope when you talk to clients.'],
  ['Deliver in one place', 'Track projects, status, and assets without tool-hopping.'],
  ['Scale your agency', 'Add team roles, plans, and partner referrals as you grow.'],
]
const features = [
  ['Team collaboration', 'Shared workspaces, roles, and client-ready project views.'],
  ['Delivery systems', 'Reusable flows for recurring digital services.'],
  ['Grow without switching', 'From solo operator to agency in the same product.'],
  ['One platform', 'Services, samples, orders, and lead packs in one place.'],
]
const ease = [0.22, 1, 0.36, 1] as const

type SampleCard = { id: string; title: string; description?: string | null; thumbnail_url?: string | null }

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const [liveServices, setLiveServices] = useState<string[][] | null>(null)
  const [samples, setSamples] = useState<SampleCard[]>([])
  const [activeService, setActiveService] = useState(0)
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const reduced = useReducedMotion()
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const entryHref = signedIn ? '/dashboard' : '/login'
  const services = liveServices ?? fallbackServices
  const selected = services[Math.min(activeService, services.length - 1)]

  useEffect(() => {
    const controller = new AbortController()
    async function loadCatalog() {
      try {
        const response = await fetch('/api/public/catalog', { signal: controller.signal })
        if (!response.ok) throw new Error('Catalog unavailable')
        const data = await response.json()
        if (Array.isArray(data.services) && data.services.length) {
          setLiveServices(
            data.services.map((service: { title: string; description?: string }) => [
              service.title,
              service.description || 'Published service',
            ]),
          )
        }
        if (Array.isArray(data.samples)) setSamples(data.samples)
        setCatalogState('ready')
      } catch {
        if (!controller.signal.aborted) setCatalogState('unavailable')
      }
    }
    void loadCatalog()
    return () => controller.abort()
  }, [])

  return (
    <main className="editorial-home">
      <a className="editorial-skip" href="#home-content">
        Skip to content
      </a>
      <SiteHeader editorial />

      <section
        id="home-content"
        className="editorial-hero editorial-wrap"
        aria-labelledby="home-title"
      >
        <div className="editorial-eyebrow hero-eyebrow">
          <span>01 — THE AGENCY WORKSPACE</span>
          <span className="hero-side-note">
            Built for your next chapter <ArrowDown size={13} />
          </span>
        </div>
        <h1 id="home-title" className="editorial-headline">
          <span className="headline-line">
            <span>MAKE GOOD WORK.</span>
          </span>
          <span className="headline-line">
            <span>BUILD YOUR AGENCY.</span>
          </span>
        </h1>
        <div className="editorial-hero-bottom">
          <Reveal className="hero-intro" delay={0.15}>
            <p className="editorial-script">Make it yours.</p>
            <div className="hero-intro-bottom">
              <p>
                A home for your services,
                <br className="desktop-break" /> your portfolio, and your
                <br className="desktop-break" /> next client project.
              </p>
              <HeroCtas />
              <a href="#how" className="editorial-text-link">
                See how it works <ArrowDown size={14} />
              </a>
            </div>
          </Reveal>
          <div
            className="hero-art"
            aria-label="How drop servicing works: receive the brief, manage the project, a specialist completes the work, and you deliver it to the client"
          >
            <motion.div
              className="drop-process"
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.8, ease }}
            >
              <div className="drop-process-head">
                <span>DROP SERVICING FLOW</span>
                <span className="drop-process-live"><i /> ONE SIMPLE WORKFLOW</span>
              </div>
              <div className="drop-process-track" aria-hidden="true">
                <span className="drop-process-line" />
                <span className="drop-process-pulse" />
              </div>
              <ol className="drop-process-steps">
                <li style={{ '--step-delay': '0s' } as CSSProperties}>
                  <span className="drop-step-number">01</span>
                  <span className="drop-step-icon"><ClipboardList size={20} /></span>
                  <strong>Client brief</strong>
                  <small>Receive goals and files.</small>
                </li>
                <li style={{ '--step-delay': '1.6s' } as CSSProperties}>
                  <span className="drop-step-number">02</span>
                  <span className="drop-step-icon"><Users size={20} /></span>
                  <strong>You manage</strong>
                  <small>Price it and assign it.</small>
                </li>
                <li style={{ '--step-delay': '3.2s' } as CSSProperties}>
                  <span className="drop-step-number">03</span>
                  <span className="drop-step-icon"><Sparkles size={20} /></span>
                  <strong>Expert creates</strong>
                  <small>A specialist completes the work.</small>
                </li>
                <li style={{ '--step-delay': '4.8s' } as CSSProperties}>
                  <span className="drop-step-number">04</span>
                  <span className="drop-step-icon"><PackageCheck size={20} /></span>
                  <strong>You deliver</strong>
                  <small>Review and send to your client.</small>
                </li>
              </ol>
              <div className="drop-process-footer">
                <span>CLIENT</span>
                <span>YOUR AGENCY STAYS IN CONTROL</span>
                <span>DELIVERY</span>
              </div>
            </motion.div>
            <span className="hero-art-caption">DROPVERSE / BRIEF TO DELIVERY — LIVE PROCESS</span>
          </div>
        </div>
        <div className="editorial-index-bar">
          <span>A CLEARER WAY TO WORK</span>
          <div>
            <a href="#services">Services</a>
            <span>/</span>
            <a href="/samples">Samples</a>
            <span>/</span>
            <a href={entryHref}>Projects</a>
            <span>/</span>
            <a href="/leads">Leads</a>
          </div>
        </div>
      </section>

      <section
        id="services"
        className="editorial-section editorial-wrap services-section"
        aria-labelledby="services-title"
      >
        <Reveal className="services-intro">
          <p className="editorial-eyebrow">02 — YOUR OFFERING</p>
          <h2 id="services-title" className="editorial-display">
            Your craft.
            <br />
            More possibilities.
          </h2>
          <p className="editorial-body">
            From brand and web to content and motion. Find the services that fit the way you work.
          </p>
          <Link href="/pricing" className="editorial-text-link">
            Explore plans <ArrowUpRight size={17} />
          </Link>
          <div className="service-art" aria-hidden="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeService}
                className={`service-art-inner service-art-${activeService % 3}`}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.25 }}
              >
                <span className="editorial-eyebrow">THE CREATIVE POSSIBILITIES</span>
                <span className="service-art-title">
                  Ideas
                  <br />
                  take
                  <br />
                  <em>shape.</em>
                </span>
                <span className="service-art-label">
                  {selected?.[0]} <ArrowUpRight size={18} />
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
        <div className="service-list">
          {services.map(([title, description], index) => (
            <div
              key={title + index}
              className={`service-row ${index === activeService ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveService(index)}
            >
              <button
                onClick={() => setActiveService(index)}
                onFocus={() => setActiveService(index)}
                aria-expanded={index === activeService}
                aria-controls={`service-description-${index}`}
              >
                <span className="service-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{title}</span>
                <ArrowUpRight size={22} />
              </button>
              <div
                id={`service-description-${index}`}
                className="service-description"
                hidden={index !== activeService}
              >
                <p>{description}</p>
              </div>
            </div>
          ))}
          <p className="service-list-note">
            {liveServices
              ? 'Services from the published catalog.'
              : 'Explore our service categories. Availability is confirmed in the catalog.'}
          </p>
        </div>
      </section>

      {/* REMAINDER_PLACEHOLDER - will fix if truncated */}
    </main>
  )
}
