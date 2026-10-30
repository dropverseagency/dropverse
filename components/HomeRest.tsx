'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Plus } from 'lucide-react'
import Brand from './Brand'
import { MARKET_FACTS } from '../lib/marketFacts'
import { MarketCite } from './MarketCite'

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

export default function HomeRest({ entryHref, signedIn }: { entryHref: string; signedIn: boolean }) {
  const [liveServices, setLiveServices] = useState<string[][] | null>(null)
  const [samples, setSamples] = useState<SampleCard[]>([])
  const [activeService, setActiveService] = useState(0)
  const reduced = useReducedMotion()
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
      } catch {
        /* keep fallbacks */
      }
    }
    void loadCatalog()
    return () => controller.abort()
  }, [])

  return (
    <>
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
    </>
  )
}
