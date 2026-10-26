import type { Metadata } from 'next'
import Link from 'next/link'
import Brand from '../../components/Brand'

export const metadata: Metadata = {
  title: { absolute: 'Tools for Drop Servicers | DropVerse' },
  description: 'Explore the work tools DropVerse is developing for Drop Servicers.',
  robots: { index: true, follow: true },
}

const plannedTools = [
  {
    name: 'Delivery tracker',
    description: 'Keep each sold service and its delivery date in one place.',
  },
  {
    name: 'Client follow-up reminders',
    description: 'Get a reminder when a client has not replied.',
  },
  {
    name: 'Lead list organiser',
    description: 'Sort and tag the lead packs you have purchased.',
  },
] as const

function StatusBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--dv-line)] bg-[var(--dv-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--dv-muted)]">
      {children}
    </span>
  )
}

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[var(--dv-deep)] text-[var(--dv-paper)]">
      <header className="border-b border-[var(--dv-line)] bg-[var(--dv-deep)]">
        <div className="container flex h-20 items-center">
          <Brand />
        </div>
      </header>

      <div className="container pb-20 pt-16 sm:pb-28 sm:pt-24">
        <section className="max-w-3xl text-start" aria-labelledby="tools-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dv-muted)]">
            TOOLS FOR DROP SERVICERS
          </p>
          <h1 id="tools-title" className="font-display mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Work tools for the people who sell the work.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--dv-muted)] sm:text-lg sm:leading-8">
            A small set of tools that help you prepare offers, write client messages, and keep track of delivery.
            Tools are being built one at a time.
          </p>
          <p className="mt-5 border-s-2 border-[var(--dv-line)] ps-4 text-sm font-medium text-[var(--dv-muted)]">
            Status: In development. Nothing on this page is live yet.
          </p>
        </section>

        <section className="mt-16 sm:mt-20" aria-labelledby="first-tool-title">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dv-muted)]">First tool</p>
          <article className="mt-5 rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="first-tool-title" className="font-display text-2xl font-bold sm:text-3xl">
                Offer and message builder
              </h2>
              <StatusBadge>In development</StatusBadge>
            </div>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--dv-muted)]">
              Turn a client request and a fulfilment cost into a clean offer and a short follow-up message. You review and send everything yourself.
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                'Start from a client request',
                'Edit the offer and the message',
                'Copy or export the text',
              ].map((item) => (
                <li key={item} className="rounded-2xl border border-[var(--dv-line)] bg-[var(--dv-deep)] p-4 text-sm leading-6 text-[var(--dv-paper)]">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="mt-16 sm:mt-20" aria-labelledby="planned-tools-title">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dv-muted)]">Next in line</p>
            <h2 id="planned-tools-title" className="font-display mt-4 text-3xl font-bold sm:text-4xl">Planned tools</h2>
          </div>
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {plannedTools.map((tool) => (
              <article key={tool.name} className="rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-6 sm:p-7">
                <StatusBadge>Planned</StatusBadge>
                <h3 className="font-display mt-6 text-xl font-bold">{tool.name}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--dv-muted)]">{tool.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface-2)] p-6 sm:mt-20 sm:p-8" aria-labelledby="building-title">
          <h2 id="building-title" className="font-display text-2xl font-bold">How we are building this</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--dv-muted)]">
            We release one tool at a time and test each with real Drop Servicers before adding the next. Pricing will be published when the first tool is ready.
          </p>
        </section>

        <div className="mt-12 border-t border-[var(--dv-line)] pt-8">
          <Link href="/" className="text-sm font-semibold text-[var(--dv-muted)] underline decoration-[var(--dv-line)] underline-offset-4 hover:text-[var(--dv-paper)]">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
