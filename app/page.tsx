'use client'

import { type CSSProperties } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ClipboardList, PackageCheck, Sparkles, Users } from 'lucide-react'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../lib/useAuth'
import HeroCtas from '../components/HeroCtas'
import HomeRest from '../components/HomeRest'
import './editorial.css'

const ease = [0.22, 1, 0.36, 1] as const

export default function Home() {
  const reduced = useReducedMotion()
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const entryHref = signedIn ? '/dashboard' : '/login'

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
          <div className="hero-intro">
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
          </div>
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

      <HomeRest entryHref={entryHref} signedIn={signedIn} />
    </main>
  )
}
