'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Plus } from 'lucide-react'
import Brand from './Brand'
import { MARKET_FACTS } from '../lib/marketFacts'
import { MarketCite } from './MarketCite'

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
const ease = [0.22, 1, 0.36, 1] as const

type SampleCard = { id: string; title: string; description?: string | null; thumbnail_url?: string | null }

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
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

export default function HomeRestLower({
  entryHref,
  signedIn,
  samples,
}: {
  entryHref: string
  signedIn: boolean
  samples: SampleCard[]
}) {
  return (
    <>
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
                <h3>A space for what comes next.</h3>
                <p>No featured samples are published yet. Explore the library for available work.</p>
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
    </>
  )
}
