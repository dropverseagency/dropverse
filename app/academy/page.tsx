'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileText,
  Handshake,
  Layers,
  Lock,
  MessageSquare,
  Package,
  PlayCircle,
  Rocket,
  Target,
  Users,
  Video,
  Wrench,
} from 'lucide-react'
import Brand from '../../components/Brand'
import SiteHeader from '../../components/SiteHeader'

const STAGES = [
  {
    n: '01',
    title: 'Understand Drop Servicing',
    desc: 'How the model works: connecting clients with providers, pricing, margins, costs, and your responsibilities as the operator.',
    icon: BookOpen,
  },
  {
    n: '02',
    title: 'Choose Your Niche',
    desc: 'Video editing, UGC, web design, Shopify development — pick based on demand, delivery capability, and realistic costs.',
    icon: Compass,
  },
  {
    n: '03',
    title: 'Build Your Service Offer',
    desc: 'Define packages, price points, deliverables, revisions, deadlines, and clear client expectations.',
    icon: Package,
  },
  {
    n: '04',
    title: 'Find Your First Client',
    desc: 'Identify prospects, write personalized outreach, follow up, and prepare a simple proposal — with lawful use of contact data.',
    icon: MessageSquare,
  },
  {
    n: '05',
    title: 'Deliver the Service',
    desc: 'Find freelancers, write briefs, review work, manage revisions, and protect client trust throughout delivery.',
    icon: Handshake,
  },
  {
    n: '06',
    title: 'Your 7-Day Launch Plan',
    desc: 'A practical plan to turn learning into a first test of your offer — not a promise of clients, sales, or income.',
    icon: Rocket,
  },
] as const

const HOW = [
  {
    title: 'Written lessons',
    desc: 'Clear explanations of each stage so you can learn at your own pace.',
    icon: FileText,
  },
  {
    title: 'Video when available',
    desc: 'Short walkthroughs will be added as real content is produced — nothing fake is listed as live.',
    icon: Video,
  },
  {
    title: 'Templates & worksheets',
    desc: 'Practical tools you can reuse when you build offers, outreach, and delivery systems.',
    icon: ClipboardList,
  },
  {
    title: 'Action exercises',
    desc: 'Each stage ends with something you can do — the goal is application, not passive reading.',
    icon: Target,
  },
] as const

const PLANNED_RESOURCES = [
  'Niche Selection Worksheet',
  'Service Offer Builder',
  'Pricing and Profit Calculator',
  'Client Outreach Templates',
  'Freelancer Brief',
  'Quality Control Checklist',
  '7-Day Launch Plan',
] as const

const ADVANCED_TOPICS = [
  'Advanced pricing and profit optimization',
  'Repeatable client acquisition systems',
  'Freelancer and team management',
  'Standard Operating Procedures (SOPs)',
  'Quality control and delivery systems',
  'Scaling across multiple clients',
] as const

export default function AcademyPage() {
  return (
    <main className="min-h-screen bg-[#071f1d] text-[#d9e0dc]">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(216,180,90,0.12),_transparent_55%)]" />
        <div className="container relative pb-16 pt-28 sm:pb-20 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d8b45a]">DropVerse Academy</p>
            <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Learn drop servicing.
              <span className="block text-[#e4c979]">Build your digital service business.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#8fa29c] sm:text-lg">
              Choose a service, shape your offer, reach potential clients, and manage delivery — one practical step at a
              time. The beginner path is free. Advanced training is in preparation.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#beginner"
                className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
              >
                Start Learning for Free <ArrowRight size={18} />
              </a>
              <a
                href="#paths"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-[rgba(216,180,90,0.4)]"
              >
                Explore the Learning Paths
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(111,191,115,0.35)] bg-[rgba(111,191,115,0.1)] px-3 py-1.5 font-semibold text-[#6fbf73]">
                <CheckCircle2 size={14} /> Beginner path · Free
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-semibold text-[#849792]">
                <Lock size={13} /> Advanced path · Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Paths */}
      <section id="paths" className="container scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Choose your path</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold text-white sm:text-4xl">Two tracks. One clear start.</h2>
          <p className="mt-4 text-[#8fa29c]">
            Begin with the free fundamentals. Advanced material for operators who already run a service business is being
            prepared — it is not available yet.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-5">
          {/* Beginner — dominant */}
          <div className="relative overflow-hidden rounded-3xl border border-[rgba(216,180,90,0.4)] bg-gradient-to-br from-[#1a2f1c] via-[#0b2a26] to-[#071f1d] p-7 sm:p-8 lg:col-span-3">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[rgba(216,180,90,0.12)] blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[rgba(111,191,115,0.4)] bg-[rgba(111,191,115,0.12)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#6fbf73]">
                  Free
                </span>
                <span className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.1)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#e4c979]">
                  Available to start
                </span>
              </div>
              <h3 className="font-display mt-4 text-2xl font-extrabold text-white sm:text-3xl">Start from Zero</h3>
              <p className="mt-3 text-sm leading-6 text-[#a8b8b2]">
                A beginner-friendly path for people who want to understand drop servicing and prepare a first offer —
                without requiring prior clients or an agency.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#c5d0cb]">
                {['Six practical stages', 'Written lessons + planned templates', 'No purchase required'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#beginner"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
              >
                Start Learning for Free <ArrowRight size={16} />
              </a>
            </div>
          </div>

          {/* Advanced — secondary */}
          <div className="rounded-3xl border border-white/10 bg-[#0a2926] p-7 sm:p-8 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#9aa8a3]">
                Paid · Planned
              </span>
              <span className="rounded-full border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.08)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#c9b06a]">
                Coming soon
              </span>
            </div>
            <h3 className="font-display mt-4 text-xl font-extrabold text-white">Advanced Drop Servicing</h3>
            <p className="mt-3 text-sm leading-6 text-[#849792]">
              For operators who already understand the basics and want systems for pricing, acquisition, teams, and
              scale. Content is being prepared — nothing is for sale here yet.
            </p>
            <button
              type="button"
              disabled
              className="mt-7 inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-[#6f837d]"
              aria-disabled="true"
            >
              <Lock size={14} /> Notify me later
            </button>
            <p className="mt-2 text-[11px] leading-4 text-[#5f726c]">Informational only — no checkout or payment.</p>
          </div>
        </div>
      </section>

      {/* Beginner curriculum */}
      <section id="beginner" className="scroll-mt-24 border-y border-white/5 bg-[#061916]/50 py-16 sm:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Beginner curriculum</p>
            <h2 className="font-display mt-3 text-3xl font-extrabold text-white sm:text-4xl">Six stages. Clear progression.</h2>
            <p className="mt-4 text-[#8fa29c]">
              Overview of the free path. Lesson pages will open as content is published — stages below describe the
              planned structure, not fabricated completion stats.
            </p>
          </div>

          <ol className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((stage) => {
              const Icon = stage.icon
              return (
                <li
                  key={stage.n}
                  className="flex flex-col rounded-2xl border border-white/5 bg-[#0a2926] p-6 transition hover:border-[rgba(216,180,90,0.25)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
                      <Icon size={20} />
                    </div>
                    <span className="font-display text-2xl font-extrabold text-white/15">{stage.n}</span>
                  </div>
                  <h3 className="font-display mt-4 text-lg font-bold text-white">{stage.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#849792]">{stage.desc}</p>
                  <span className="mt-4 inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7f918c]">
                    Structure planned
                  </span>
                </li>
              )
            })}
          </ol>

          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] px-5 py-4 text-center text-sm text-[#c9b06a]">
            Full lesson pages are not published yet. This page shows the learning path so you can see what is being
            built. When a lesson goes live, it will be clearly marked as available.
          </div>
        </div>
      </section>

      {/* How learning works */}
      <section className="container py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d8b45a]">How learning works</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold text-white">Practical by design</h2>
          <p className="mt-4 text-[#8fa29c]">
            The aim is to help you apply ideas — choose a niche, write an offer, test outreach — not to promise results.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="rounded-2xl border border-white/5 bg-[#0a2926] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
                  <Icon size={18} />
                </div>
                <h3 className="font-display mt-4 text-base font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#849792]">{item.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Templates preview */}
      <section className="border-y border-white/5 bg-[#061916]/40 py-16 sm:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Templates & tools</p>
            <h2 className="font-display mt-3 text-3xl font-extrabold text-white">Resources on the roadmap</h2>
            <p className="mt-4 text-[#8fa29c]">
              These worksheets are planned for the free path. Downloads appear only when a real file is ready — nothing
              below is linked as a live download yet.
            </p>
          </div>
          <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
            {PLANNED_RESOURCES.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#0a2926] px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <Wrench size={16} className="shrink-0 text-[#d8b45a]" />
                  <span className="text-sm font-medium text-[#c5d0cb]">{name}</span>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6f837d]">
                  Planned
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Advanced preview */}
      <section id="advanced" className="container scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a2926]">
          <div className="border-b border-white/5 bg-[#071f1d]/80 px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <Layers size={18} className="text-[#d8b45a]" />
              <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Advanced Academy</h2>
              <span className="rounded-full border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.08)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#e4c979]">
                Coming soon
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#849792]">
              A future paid track for people who already run drop-servicing work and want stronger systems. We are not
              collecting payment or opening enrollment on this page.
            </p>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
            {ADVANCED_TOPICS.map((topic) => (
              <div key={topic} className="flex items-start gap-3 rounded-xl border border-white/5 bg-[#071f1d]/60 px-4 py-3">
                <Briefcase size={16} className="mt-0.5 shrink-0 text-[#7f918c]" />
                <span className="text-sm text-[#a8b8b2]">{topic}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 px-6 py-5 sm:px-8">
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#6f837d]"
              aria-disabled="true"
            >
              <Lock size={14} /> Enrollment not open
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/5 bg-gradient-to-b from-[#0b2a26] to-[#071f1d] py-16 sm:py-20">
        <div className="container text-center">
          <PlayCircle className="mx-auto text-[#d8b45a]" size={36} />
          <h2 className="font-display mt-5 text-3xl font-extrabold text-white sm:text-4xl">Begin with the free path</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#8fa29c]">
            Review the six stages, prepare to test an offer, and use DropVerse tools when you are ready to work with
            clients and freelancers. No guaranteed income — just a structured way to start.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#beginner"
              className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
            >
              Start Learning for Free <ArrowRight size={18} />
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-[rgba(216,180,90,0.4)]"
            >
              Back to DropVerse
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Brand compact />
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#83958f]">
            <Link href="/" className="hover:text-[#d8b45a]">
              Home
            </Link>
            <Link href="/academy" className="hover:text-[#d8b45a]">
              Academy
            </Link>
            <Link href="/leads" className="hover:text-[#d8b45a]">
              Lead Marketplace
            </Link>
            <Link href="/earn" className="hover:text-[#d8b45a]">
              Become a Partner
            </Link>
            <Link href="/pricing" className="hover:text-[#d8b45a]">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-[#d8b45a]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#d8b45a]">
              Terms
            </Link>
          </div>
          <p className="text-sm text-[#667c75]">© {new Date().getFullYear()} DropVerse</p>
        </div>
      </footer>
    </main>
  )
}
