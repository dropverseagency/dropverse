import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Target,
} from 'lucide-react'
import SiteHeader from '../../../../components/SiteHeader'
import Brand from '../../../../components/Brand'

type Lesson = {
  number: string
  slug: string
  title: string
  subtitle: string
  time: string
  intro: string
  sections: { heading: string; body: string; bullets?: string[]; example?: string }[]
  exercise: string[]
  deliverable: string
  next: string
}

const LESSONS: Lesson[] = [
  {
    number: '01', slug: 'drop-servicing-basics', title: 'Understand Drop Servicing',
    subtitle: 'Learn the business model before you spend money or promise results.',
    time: '15–20 min',
    intro: 'Drop servicing means selling a clearly defined service to a client and arranging for a capable freelancer or delivery partner to complete the work. Your value is not simply “reselling”; you own the client relationship, scope, communication, quality checks, and delivery process.',
    sections: [
      { heading: 'How the workflow works', body: 'A simple project usually follows this path:', bullets: ['Find a business with a relevant problem and start a respectful conversation.', 'Understand the outcome they need, their deadline, budget, and constraints.', 'Send a written offer that lists deliverables, revisions, timeline, price, and exclusions.', 'Confirm payment and project terms before committing delivery resources.', 'Brief the freelancer, review the work against the agreed scope, and manage feedback.', 'Deliver the approved files, ask for feedback, and document what you learned.'] },
      { heading: 'Know the three roles', body: 'The client pays for an outcome. You manage the offer and client experience. The freelancer supplies specialist execution. Make sure every person knows who is responsible for communication, revisions, approvals, and deadlines.' },
      { heading: 'Understand the numbers', body: 'Revenue is what the client pays. Direct delivery cost is what you pay the freelancer and other project-specific providers. Gross project margin is revenue minus direct costs; it is not the same as final profit because software, payment fees, refunds, taxes, and your time may still cost money.', example: 'Example only: a $500 project minus $220 freelancer cost and $20 payment/other direct costs leaves $260 before overhead, taxes, refunds, and your own time. Never price using revenue alone.' },
      { heading: 'Risks to manage from day one', body: 'Never promise work before confirming that it can be delivered. Use written scope and payment terms, protect client data, obtain permission for portfolio use, and check that any assets, music, fonts, footage, or datasets can legally be used. Keep a cash buffer for revisions or refunds.' },
    ],
    exercise: ['Write the service you would sell in one sentence.', 'List what the client receives and what is explicitly excluded.', 'Estimate delivery cost, fees, contingency, and the minimum price you would accept.', 'Write one risk you must verify before accepting the first order.'],
    deliverable: 'A one-page model map: client problem → offer → delivery partner → quality check → handoff.',
    next: 'choose-your-niche',
  },
  {
    number: '02', slug: 'choose-your-niche', title: 'Choose Your Niche',
    subtitle: 'Pick a focused buyer and a problem you can reliably solve.',
    time: '20 min',
    intro: 'A niche is more useful than a broad service label. “Video editing” is a service; “short-form edits for fitness coaches publishing weekly educational videos” describes a buyer, a recurring need, and a clear use case. Focus makes prospecting, messaging, pricing, and delivery easier to improve.',
    sections: [
      { heading: 'Use the four-fit test', body: 'Score each possible niche from 1–5 on these factors:', bullets: ['Visible demand: can you find real businesses already paying for or using this service?', 'Reachability: can you identify the right business and contact it appropriately?', 'Delivery access: do you have a reliable freelancer or realistic way to produce the work?', 'Economics: can a client price cover delivery, fees, revisions, and a sensible margin?'] },
      { heading: 'Start narrow, then validate', body: 'Choose one buyer type, one problem, and one starter service for a two-week test. Avoid trying to sell editing, websites, logos, ads, and SEO to every business at once. You can expand after evidence shows which offer gets relevant replies and can be delivered profitably.' },
      { heading: 'Examples of specific positioning', body: 'Examples to research—not claims that these buyers are already interested:', bullets: ['Short-form video editing for coaches who publish long videos but few clips.', 'Product demo and UGC-style creative production for small e-commerce brands.', 'Landing-page improvement for a specific type of online store.', 'Simple website builds for local businesses whose online presence is outdated.'] },
      { heading: 'Validate with evidence', body: 'Review a sample of real prospects. Note the public business website or profile, the observable gap, why your service may help, and the source/date. A weak website is a reason to investigate, not proof that the owner wants to buy. Do not label a prospect “interested” without an actual signal.' },
    ],
    exercise: ['List three buyer niches you can reach.', 'Score each from 1–5 on demand, reachability, delivery access, and economics.', 'Review ten real businesses in the strongest niche and record one specific observation for each.', 'Choose one niche for a short test and define what evidence would make you continue or change.'],
    deliverable: 'A niche decision sheet with a buyer, problem, service, evidence, and validation target.',
    next: 'build-your-offer',
  },
  {
    number: '03', slug: 'build-your-offer', title: 'Build Your Service Offer',
    subtitle: 'Turn a vague skill into a clear, priced package.',
    time: '20–25 min',
    intro: 'A client should understand what they are buying without needing to guess. A strong starter offer describes a specific outcome, exact deliverables, the working process, the timeline, and the boundaries. Clarity protects both your margin and the client relationship.',
    sections: [
      { heading: 'Define the deliverables', body: 'Describe outputs in countable terms. Include format, length, dimensions, file type, quantity, and whether source files are included. Replace “social media management” with a precise scope such as a defined number of edited clips, caption files, and one revision round.' },
      { heading: 'Set boundaries before quoting', body: 'Write down what the package excludes, how many revisions are included, what counts as a new request, what the client must provide, who approves the work, and what happens if assets or feedback arrive late. Do not use unlimited revisions unless the price and process truly support them.' },
      { heading: 'Price from costs and value', body: 'Calculate freelancer cost + direct tools/fees + revision buffer + your required margin. Compare that floor with the value and alternatives available to the buyer. If the market will not support your minimum viable price, adjust the scope, buyer, or delivery method rather than hiding costs.', example: 'Illustration: $180 delivery + $20 fees/tools + $30 buffer = $230 estimated cost. A $350 price leaves $120 before general overhead, tax, refunds, and your time. These are sample figures, not a recommended market rate.' },
      { heading: 'Use a simple offer format', body: 'Your offer can fit on one page: who it is for, problem addressed, deliverables, process, timeline, price and payment schedule, revision policy, client responsibilities, exclusions, and next step. Avoid guarantees about sales, views, or revenue unless you can substantiate and contractually support them.' },
    ],
    exercise: ['Write a one-sentence promise focused on a deliverable or controllable outcome.', 'List exact deliverables and exclusions.', 'Calculate your minimum viable price using realistic delivery costs and a buffer.', 'Draft a short proposal with timeline, payment terms, and revision policy.'],
    deliverable: 'A ready-to-send one-page service offer and a transparent price calculation.',
    next: 'find-your-first-client',
  },
  {
    number: '04', slug: 'find-your-first-client', title: 'Find Your First Client',
    subtitle: 'Build a small, relevant prospect list and start genuine conversations.',
    time: '25 min',
    intro: 'The goal of outreach is not to send the largest possible number of messages. It is to find businesses that plausibly fit your offer, understand a specific need, and start a relevant conversation. Consistency and thoughtful follow-up beat generic mass messages.',
    sections: [
      { heading: 'Build a focused prospect list', body: 'For each prospect, record business name, official website/profile, country, niche, appropriate public business contact channel, source, date checked, and the specific observation that makes your offer relevant. Remove duplicates and stale records. Respect privacy, platform terms, anti-spam rules, and opt-out requests in the countries you target.' },
      { heading: 'Personalize around an observation', body: 'Mention one accurate, publicly observable detail and connect it to a possible improvement. Keep the message short. Do not pretend you watched, tested, or analyzed something you did not. Avoid claims that the recipient has a problem unless your evidence supports that claim.' },
      { heading: 'Example first message', body: '“Hi [Name] — I noticed [specific, accurate observation] on [business/page]. I help [type of business] with [specific service]. I had one idea that could help with [relevant outcome]. Would it be useful if I sent a short example?”', example: 'Use this as a starting point, not a copy-paste blast. If they say no or ask not to be contacted, respect that immediately.' },
      { heading: 'Track the process', body: 'Track the date contacted, channel, response, next step, and opt-out status. Follow up politely once or twice only where lawful and appropriate, spacing messages out and adding value. Measure qualified replies and booked conversations, not just messages sent.' },
      { heading: 'Prepare before sending', body: 'Have a simple sample or relevant case study, a clear offer, a realistic price range, and answers to questions about process and delivery. Never fabricate testimonials, client results, or portfolio ownership.' },
    ],
    exercise: ['Find ten businesses in your chosen niche and record the evidence/source for each.', 'Write a different opening line for three prospects using a real observation.', 'Prepare one relevant sample or a short mock-up clearly labeled as a concept.', 'Set a small daily outreach target and a follow-up rule that respects opt-outs and local laws.'],
    deliverable: 'A clean ten-prospect list and three personalized messages ready for careful review.',
    next: 'service-delivery',
  },
  {
    number: '05', slug: 'service-delivery', title: 'Deliver the Service',
    subtitle: 'Protect trust with a good brief, checkpoints, and quality control.',
    time: '20 min',
    intro: 'Selling the project is only the beginning. A repeatable delivery process makes work more predictable, reduces avoidable revisions, and helps you earn referrals. Do not rely on a vague message to a freelancer or assume the client and provider mean the same thing by “done.”',
    sections: [
      { heading: 'Write a freelancer brief', body: 'Include the client goal, target audience, deliverables, references, brand assets, technical specifications, deadline, milestones, file handoff requirements, and what success looks like. Confirm the freelancer understands the brief, capacity, price, and rights to all supplied or created assets before work begins.' },
      { heading: 'Use checkpoints', body: 'For larger projects, agree on a small early checkpoint before the full delivery. Share only the client information the freelancer needs. Keep approvals and scope changes in writing, and tell the client promptly if a risk threatens the timeline.' },
      { heading: 'Review against a checklist', body: 'Check every deliverable against the agreed scope, spelling, technical specs, links, file access, brand guidelines, and completeness. For video, review audio, aspect ratio, captions, pacing, and export quality. For websites, check mobile layout, forms, links, loading behavior, and access/security basics.' },
      { heading: 'Handle revisions professionally', body: 'Collect feedback in one place, compare it with the original brief, and distinguish an included correction from a new request. Confirm any change in scope, cost, or timeline before proceeding. Never conceal a delay or pass unreviewed work to the client.' },
      { heading: 'Close the loop', body: 'Deliver files securely, confirm receipt, document final approval, and request concise feedback. Ask permission before displaying client work publicly. Record actual time and costs so the next quote becomes more accurate.' },
    ],
    exercise: ['Create a reusable freelancer brief for your chosen service.', 'Build a five-to-ten-point quality checklist for the final handoff.', 'Write a short client update for a project that is on track and one for a delay.', 'Define how you will handle extra work and revision requests.'],
    deliverable: 'A freelancer brief, quality-control checklist, and written revision process.',
    next: 'seven-day-launch-plan',
  },
  {
    number: '06', slug: 'seven-day-launch-plan', title: 'Your 7-Day Launch Plan',
    subtitle: 'Turn the lessons into a small, measurable market test.',
    time: '15 min to plan; 30–90 min/day to execute',
    intro: 'This is a validation sprint, not a promise of clients or income. The objective is to create one focused offer, test it with relevant prospects, learn from the responses, and decide what to improve next.',
    sections: [
      { heading: 'Day 1 — Pick the buyer', body: 'Choose one niche and one problem. Write why the problem matters and what public evidence would indicate a possible fit.' },
      { heading: 'Day 2 — Confirm delivery', body: 'Talk to a capable freelancer or delivery partner, check relevant samples and availability, estimate costs, and understand usage rights. Do not sell a capability you cannot deliver.' },
      { heading: 'Day 3 — Package the offer', body: 'Set deliverables, exclusions, revisions, timeline, client responsibilities, payment terms, and a minimum viable price. Create a short proposal.' },
      { heading: 'Day 4 — Make a proof asset', body: 'Create one honest sample, concept, audit, or demonstration that shows your approach. Label speculative work as a concept and never present it as a paid client result.' },
      { heading: 'Day 5 — Research prospects', body: 'Build a small list of relevant businesses. Verify each record, note the source and date, remove duplicates, and write a specific reason for contacting each one.' },
      { heading: 'Day 6 — Reach out thoughtfully', body: 'Send a manageable batch of personalized messages through appropriate channels. Record outcomes, respect opt-outs, and avoid misleading claims or automated spam.' },
      { heading: 'Day 7 — Review and decide', body: 'Review delivered messages, relevant replies, objections, booked calls, and delivery economics. Improve one weak point and plan the next test. If nobody replies, treat it as data—not proof that the whole model cannot work.' },
      { heading: 'Measure the right signals', body: 'Track inputs and learning: prospects researched, messages sent appropriately, replies, positive replies, calls, proposals, and delivery-cost estimates. One week is a small sample; avoid drawing confident conclusions from a handful of contacts.' },
    ],
    exercise: ['Put a realistic task and time block on each of the seven days.', 'Set a measurable validation goal that you control, such as completing the offer and researching 20 qualified prospects.', 'Define what evidence would make you refine the message, change the offer, or test a different niche.', 'Choose the next review date and record the results honestly.'],
    deliverable: 'A seven-day calendar, one offer, one proof asset, and a simple results tracker.',
    next: '',
  },
]

export function generateStaticParams() {
  return LESSONS.map((lesson) => ({ slug: lesson.slug }))
}

export default async function BeginnerLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const lesson = LESSONS.find((item) => item.slug === slug)
  if (!lesson) notFound()
  const currentIndex = LESSONS.findIndex((item) => item.slug === lesson.slug)
  const previous = currentIndex > 0 ? LESSONS[currentIndex - 1] : null
  const next = lesson.next ? LESSONS.find((item) => item.slug === lesson.next) : null

  return (
    <main className="min-h-screen bg-[#071f1d] text-[#d9e0dc]">
      <SiteHeader />
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(216,180,90,0.12),_transparent_55%)]" />
        <div className="container relative pb-12 pt-28 sm:pb-16 sm:pt-32">
          <Link href="/academy#beginner" className="inline-flex items-center gap-2 text-sm font-semibold text-[#9aaca5] transition hover:text-[#e4c979]">
            <ArrowLeft size={16} /> All beginner lessons
          </Link>
          <div className="mx-auto mt-8 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#d8b45a]">
              <BookOpen size={15} /> Free beginner curriculum <span className="text-white/25">/</span> Stage {lesson.number} of 06
            </div>
            <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{lesson.title}</h1>
            <p className="mt-4 text-lg leading-8 text-[#a4b5ae]">{lesson.subtitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-[#8fa29c]">
              <BookOpen size={14} /> {lesson.time} · Free lesson
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0">
          <div className="rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-1 shrink-0 text-[#d8b45a]" size={20} />
              <p className="text-base leading-7 text-[#d5dfda]">{lesson.intro}</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            {lesson.sections.map((section, index) => (
              <section key={section.heading} className="scroll-mt-24">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xs font-extrabold text-[#d8b45a]">{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{section.heading}</h2>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#9aaca5] sm:text-base">{section.body}</p>
                    {section.bullets && (
                      <ul className="mt-4 space-y-3">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-[#b9c7c1]">
                            <CheckCircle2 size={17} className="mt-1 shrink-0 text-[#d8b45a]" /> <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.example && (
                      <div className="mt-4 rounded-xl border border-white/5 bg-[#0a2926] p-4 text-sm leading-7 text-[#b9c7c1]">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#d8b45a]">Example</span>
                        {section.example}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <section className="mt-10 rounded-2xl border border-[rgba(216,180,90,0.28)] bg-[#0a2926] p-5 sm:p-7">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={20} className="text-[#d8b45a]" />
              <h2 className="font-display text-xl font-bold text-white">Your action exercise</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#8fa29c]">Complete these steps before moving on. Keep your answers in a document or notebook so you can reuse them in the next stage.</p>
            <ol className="mt-5 space-y-3">
              {lesson.exercise.map((task, index) => (
                <li key={task} className="flex items-start gap-3 text-sm leading-6 text-[#c3d0ca]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(216,180,90,0.12)] text-xs font-bold text-[#e4c979]">{index + 1}</span>
                  <span>{task}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 border-t border-white/5 pt-5">
              <div className="flex items-start gap-3">
                <Target size={18} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#d8b45a]">What you should have at the end</p>
                  <p className="mt-1 text-sm leading-6 text-white">{lesson.deliverable}</p>
                </div>
              </div>
            </div>
          </section>

          <nav className="mt-8 flex flex-col gap-3 border-t border-white/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
            {previous ? (
              <Link href={`/academy/beginner/${previous.slug}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-[#b9c7c1] transition hover:border-white/20 hover:text-white">
                <ArrowLeft size={16} /> Previous lesson
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/academy/beginner/${next.slug}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-5 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                Next: {next.title} <ArrowRight size={16} />
              </Link>
            ) : (
              <Link href="/academy#beginner" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-5 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                Back to curriculum <ArrowRight size={16} />
              </Link>
            )}
          </nav>
        </article>

        <aside className="h-fit rounded-2xl border border-white/5 bg-[#0a2926] p-5 lg:sticky lg:top-28">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d8b45a]">Your learning path</p>
          <ol className="mt-4 space-y-2">
            {LESSONS.map((item) => {
              const active = item.slug === lesson.slug
              return (
                <li key={item.slug}>
                  <Link href={`/academy/beginner/${item.slug}`} aria-current={active ? 'step' : undefined} className={`flex items-start gap-3 rounded-xl p-3 transition ${active ? 'border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.08)]' : 'border border-transparent hover:bg-white/[0.03]'}`}>
                    <span className={`mt-0.5 text-xs font-extrabold ${active ? 'text-[#e4c979]' : 'text-[#617a72]'}`}>{item.number}</span>
                    <span className={`text-sm leading-5 ${active ? 'font-bold text-white' : 'text-[#91a49c]'}`}>{item.title}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <div className="mt-5 rounded-xl border border-white/5 bg-[#071f1d]/60 p-4">
            <p className="text-xs font-bold text-white">Remember</p>
            <p className="mt-2 text-xs leading-5 text-[#81958d]">The goal is to build and test a sound process. No lesson can guarantee clients, sales, or income.</p>
          </div>
        </aside>
      </div>

      <footer className="border-t border-white/5 py-10">
        <div className="container flex flex-col items-center justify-between gap-5 sm:flex-row">
          <Brand compact />
          <Link href="/academy#beginner" className="text-sm font-semibold text-[#8fa29c] transition hover:text-[#d8b45a]">All free beginner lessons</Link>
          <p className="text-sm text-[#667c75]">© {new Date().getFullYear()} DropVerse</p>
        </div>
      </footer>
    </main>
  )
}
