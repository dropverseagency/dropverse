import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms for using DropVerse to sell services and earn referrals.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#071f1d] px-5 py-16 text-[#d9e0dc]">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">Back to DropVerse</Link>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-white">Terms</h1>
        <p className="mt-3 text-sm text-[#849792]">Last updated 9 October 2026. Contact dropverseagency@gmail.com.</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-[#c5d2cc]">
          <p>DropVerse lets you present digital services, work with talent, and track referrals. Using the site means you accept these terms.</p>
          <h2 className="font-display text-xl font-bold text-white">Accounts</h2>
          <p>You must give a real email and keep your login private. Usernames can be changed only on the cooldown shown in settings. We can suspend accounts that spam, impersonate, or abuse referrals.</p>
          <h2 className="font-display text-xl font-bold text-white">Services and samples</h2>
          <p>Landing examples are formats, not completed client jobs, until a real sample is published. You are responsible for the offer you make to your own client. DropVerse does not guarantee a sale, a delivery date, or a freelancer assignment until a project is confirmed.</p>
          <h2 className="font-display text-xl font-bold text-white">Plans</h2>
          <p>Solo is free. Agency and Pro prices on the pricing page are listed rates. Paid plan checkout is not live yet, so no subscription charge is taken from the billing page until payments are switched on.</p>
          <h2 className="font-display text-xl font-bold text-white">Referrals</h2>
          <p>Commission is a percentage of eligible DropVerse profit, not the full client price. Self-referrals do not qualify. Earnings are not guaranteed and depend on real paid activity. Payouts are reviewed before they are marked paid.</p>
          <h2 className="font-display text-xl font-bold text-white">Payments</h2>
          <p>Project payments that use SpaceRemit are confirmed on the server after amount and currency match. A public invoice link is for the client named on that invoice.</p>
        </div>
      </article>
    </main>
  )
}
