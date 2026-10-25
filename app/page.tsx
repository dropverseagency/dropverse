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
              <Link href={entryHref} className="editorial-button">
                {signedIn ? 'Open your workspace' : 'Create your workspace'}
                <ArrowUpRight size={18} />
              </Link>
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
                  <small>You receive the order and goals.</small>
                </li>
                <li style={{ '--step-delay': '1.6s' } as CSSProperties}>
                  <span className="drop-step-number">02</span>
                  <span className="drop-step-icon"><Users size={20} /></span>
                  <strong>You manage</strong>
                  <small>Scope, price, and assign the work.</small>
                </li>
                <li style={{ '--step-delay': '3.2s' } as CSSProperties}>
                  <span className="drop-step-number">03</span>
                  <span className="drop-step-icon"><Sparkles size={20} /></span>
                  <strong>Expert creates</strong>
                  <small>A trusted specialist does the work.</small>
                </li>
                <li style={{ '--step-delay': '4.8s' } as CSSProperties}>
                  <span className="drop-step-number">04</span>
                  <span className="drop-step-icon"><PackageCheck size={20} /></span>
                  <strong>You deliver</strong>
                  <small>Review, deliver, and keep the margin.</small>
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

      <section id="about" className="workspace-section" aria-labelledby="workspace-title">
        <div className="editorial-wrap">
          <div className="workspace-top">
            <Reveal>
              <p className="editorial-eyebrow">03 — BEHIND THE WORK</p>
              <h2 id="workspace-title" className="editorial-display">
                Everything behind
                <br />
                the finished work.
              </h2>
              <p className="editorial-body">
                Manage projects, collaborate with your team, and bring your services together. A little more
                structure. A lot more room to create.
              </p>
              <Link href={entryHref} className="editorial-text-link">
                Meet your workspace <ArrowUpRight size={17} />
              </Link>
            </Reveal>
            <Reveal className="workspace-preview" delay={0.15}>
              <div className="workspace-preview-top">
                <span>
                  <i /> Your workspace
                </span>
                <span className="preview-label">ILLUSTRATIVE PREVIEW</span>
              </div>
              <div className="workspace-tabs">
                <span className="selected">Projects</span>
                <span>Samples</span>
                <span>Team</span>
                <Plus size={15} />
              </div>
              <div className="workspace-table-wrap">
                <table className="workspace-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Stage</th>
                      <th>Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Brand identity', 'In review', 'Oct 28', 'identity'],
                      ['Campaign film', 'In progress', 'Nov 02', 'film'],
                      ['Studio website', 'Ready', 'Nov 06', 'web'],
                    ].map(([name, status, date, kind]) => (
                      <tr key={name}>
                        <td>
                          <span className={`project-thumb ${kind}`} aria-hidden="true">
                            {kind === 'identity' ? 'Aa' : kind === 'web' ? <ArrowUpRight size={19} /> : '▶'}
                          </span>
                          {name}
                        </td>
                        <td>
                          <span className={`project-status ${kind}`}>
                            <i />
                            {status}
                          </span>
                        </td>
                        <td>{date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="workspace-preview-bottom">
                <span>One place. Every part of the process.</span>
                <ArrowUpRight size={16} />
              </div>
              <p className="preview-disclaimer">Sample projects shown for illustration.</p>
            </Reveal>
          </div>
          <div className="workspace-features">
            {features.map(([title, text], index) => (
              <Reveal key={title} delay={index * 0.05}>
                <span className="feature-index">0{index + 1} /</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section
        id="paths"
        className="editorial-section editorial-wrap paths-section"
        aria-labelledby="paths-title"
      >
        <Reveal className="section-heading">
          <div>
            <p className="editorial-eyebrow">04 — FIND YOUR PLACE</p>
            <h2 id="paths-title" className="editorial-display">
              Different paths.
              <br />
              Shared ambition.
            </h2>
          </div>
          <p className="editorial-body">
            Start where you are. Build in the direction that feels like you. Choose one path, or make room for
            more.
          </p>
        </Reveal>
        <div className="path-grid">
          {paths.map((path, index) => (
            <Reveal key={path.title} delay={index * 0.08} className="path-item">
              <span className="editorial-eyebrow">
                0{index + 1} / {path.title}
              </span>
              <h3>{path.label}</h3>
              <p>{path.text}</p>
              <Link href={path.href} className="editorial-text-link">
                {path.cta}
                <ArrowUpRight size={17} />
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="samples" className="samples-section" aria-labelledby="samples-title">
        <div className="editorial-wrap editorial-section">
          <Reveal className="section-heading">
            <div>
              <p className="editorial-eyebrow">05 — SHOW WHAT YOU DO</p>
              <h2 id="samples-title" className="editorial-display">
                Let the work
                <br />
                <em>do the talking.</em>
              </h2>
            </div>
            <div>
              <p className="editorial-body">
                Pitch with real samples. Give your next client a clearer picture of what you can create.
              </p>
              <Link href="/samples" className="editorial-text-link">
                Browse all samples <ArrowUpRight size={17} />
              </Link>
            </div>
          </Reveal>
          {samples.length ? (
            <ul className="sample-grid">
              {samples.map((sample) => (
                <li key={sample.id}>
                  <Link href="/samples" className="sample-link">
                    {sample.thumbnail_url ? (
                      <img
                        src={sample.thumbnail_url}
                        alt={sample.title}
                        loading="lazy"
                        className="sample-image"
                      />
                    ) : (
                      <div className="sample-image sample-no-image" aria-hidden="true">
                        {sample.title.slice(0, 1)}
                      </div>
                    )}
                    <div className="sample-heading">
                      <h3>{sample.title}</h3>
                      <ArrowUpRight size={20} />
                    </div>
                    {sample.description && <p>{sample.description}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="samples-empty">
              <span className="empty-symbol" aria-hidden="true">
                <ArrowUpRight size={48} strokeWidth={1} />
              </span>
              <div>
                <h3>
                  {catalogState === 'loading'
                    ? 'Finding the latest work…'
                    : catalogState === 'unavailable'
                      ? 'The catalog is taking a moment.'
                      : 'A space for what comes next.'}
                </h3>
                <p>
                  {catalogState === 'loading'
                    ? 'Loading featured samples from the catalog.'
                    : catalogState === 'unavailable'
                      ? 'Featured samples are unavailable right now. You can still explore the sample library.'
                      : 'No featured samples are published yet. Explore the library for available work.'}
                </p>
              </div>
              <Link href="/samples" className="editorial-text-link">
                Explore samples <ArrowUpRight size={17} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section id="how" className="editorial-wrap editorial-section" aria-labelledby="how-title">
        <Reveal className="section-heading">
          <div>
            <p className="editorial-eyebrow">06 — MAKE YOUR NEXT MOVE</p>
            <h2 id="how-title" className="editorial-display">
              From first brief
              <br />
              to final delivery.
            </h2>
          </div>
          <Link href="/academy" className="editorial-text-link">
            Learn in the Academy <ArrowUpRight size={17} />
          </Link>
        </Reveal>
        <div className="process-grid">
          {steps.map(([title, text], index) => (
            <Reveal key={title} delay={index * 0.09}>
              <div className="process-number">
                <span>0{index + 1}</span>
                <ArrowRight size={18} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="markets" className="market-section" aria-labelledby="market-title">
        <div className="editorial-wrap editorial-section">
          <Reveal className="section-heading">
            <div>
              <p className="editorial-eyebrow">07 — THE BIGGER PICTURE</p>
              <h2 id="market-title" className="editorial-display">
                An independent way
                <br />
                to build online.
              </h2>
            </div>
            <p className="editorial-body">
              Explore the markets around your work. Published category estimates for context, not DropVerse
              revenue or a forecast of your earnings.
            </p>
          </Reveal>
          <div className="market-list">
            {MARKET_FACTS.map((fact, index) => (
              <details className="market-item" key={fact.id}>
                <summary>
                  <span className="service-number">0{index + 1}</span>
                  <h3>{fact.title}</h3>
                  <span className="market-figure">{fact.figure}</span>
                  <Plus size={20} />
                </summary>
                <div className="market-detail">
                  {fact.figureLabel && <p className="market-figure-label">{fact.figureLabel}</p>}
                  <p>{fact.body}</p>
                  <MarketCite
                    sourceName={fact.sourceName}
                    sourceUrl={fact.sourceUrl}
                    sourceDate={fact.sourceDate}
                    scope={fact.scope}
                  />
                  <Link href={fact.href} className="editorial-text-link">
                    {fact.cta}
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section
        id="start"
        className="editorial-wrap editorial-section start-section"
        aria-labelledby="start-title"
      >
        <Reveal>
          <p className="editorial-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2 id="start-title">
            GOOD WORK.
            <br />
            <span>YOUR WAY.</span>
            <ArrowUpRight aria-hidden="true" />
          </h2>
          <div className="start-bottom">
            <p>
              Open a workspace. Bring your ideas.
              <br />
              Make something worth sharing.
            </p>
            <div>
              <Link href={entryHref} className="editorial-button">
                {signedIn ? 'Open dashboard' : 'Start building'}
                <ArrowUpRight size={18} />
              </Link>
              <Link href="/pricing" className="editorial-text-link">
                Compare plans
                <ArrowRight size={16} />
              </Link>
              <Link href="/leads" className="editorial-text-link">
                Lead marketplace
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <p className="outcomes-note">
            <Check size={13} /> Tools for your business. Results depend on your work, clients, and market.
          </p>
        </Reveal>
      </section>

      <footer className="editorial-footer">
        <div className="editorial-wrap">
          <div className="footer-top">
            <Brand editorial />
            <p>Good work. Greater possibilities.</p>
            <a href="#home-content" className="editorial-text-link">
              Back to top <ArrowUpRight size={16} />
            </a>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <Link href="/#paths">Paths</Link>
            <Link href="/#services">Services</Link>
            <Link href="/samples">Samples</Link>
            <Link href="/leads">Leads</Link>
            <Link href="/academy">Academy</Link>
            <Link href="/earn">Become a Partner</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/refund">Refund policy</Link>
          </nav>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} DropVerse</span>
            <span>BUILT FOR THE WAY YOU WANT TO WORK.</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
