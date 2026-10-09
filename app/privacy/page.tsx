import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How DropVerse handles account, project, and payment data.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#071f1d] px-5 py-16 text-[#d9e0dc]">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">Back to DropVerse</Link>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-white">Privacy</h1>
        <p className="mt-3 text-sm text-[#849792]">Last updated 9 October 2026. Contact dropverseagency@gmail.com.</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-[#c5d2cc]">
          <p>DropVerse is a drop-servicing platform. We collect the account and project data needed to run login, workspaces, invoices, and referrals.</p>
          <h2 className="font-display text-xl font-bold text-white">What we collect</h2>
          <p>Name, email, phone, username, optional Telegram handle, and referral code. Project records include client name, client email, price, fulfillment cost, and payment status. Affiliate records include referral codes, clicks, and commission status.</p>
          <h2 className="font-display text-xl font-bold text-white">How we use it</h2>
          <p>To create your account, show your dashboard, send auth emails, calculate commissions, and confirm payments through SpaceRemit. We do not sell personal data.</p>
          <h2 className="font-display text-xl font-bold text-white">Who processes it</h2>
          <p>Supabase stores accounts and database rows. Vercel hosts the site. SpaceRemit processes payments you start. Email confirmation is sent through Supabase Auth.</p>
          <h2 className="font-display text-xl font-bold text-white">Public invoices</h2>
          <p>A project invoice link can be opened without login. It shows the client-facing invoice, not your internal cost or profit.</p>
          <h2 className="font-display text-xl font-bold text-white">Retention and requests</h2>
          <p>Account data stays while the account is active. Email dropverseagency@gmail.com to ask for an export or deletion. We may keep invoice and commission rows where we need them for accounting.</p>
        </div>
      </article>
    </main>
  )
}
