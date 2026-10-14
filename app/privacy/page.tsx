import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How DropVerse handles account, project, and payment data.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-16 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-primary hover:opacity-80">
          Back to DropVerse
        </Link>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-foreground">Privacy</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated 9 October 2026. Contact dropverseagency@gmail.com.
        </p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            DropVerse is a drop-servicing platform. We collect the account and project data needed to run login,
            workspaces, invoices, and referrals.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">What we collect</h2>
          <p>
            Name, email, phone, username, optional Telegram handle, and referral code. Project records include client
            name, client email, price, fulfillment cost, and payment status. Affiliate records include referral codes,
            clicks, and commission status.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">How we use it</h2>
          <p>
            We use this data to authenticate you, operate workspaces, issue invoices, calculate commissions, and
            improve the product. We do not sell personal data.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">Processors</h2>
          <p>
            Infrastructure providers (for example Supabase and Vercel) process data under their own terms. Payment
            providers process payment details when online payments are enabled.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">Retention & rights</h2>
          <p>
            Account data is kept while your account is active. Email dropverseagency@gmail.com to request access,
            correction, or deletion where applicable.
          </p>
        </div>
        <div className="mt-10 flex gap-4 text-sm">
          <Link href="/terms" className="font-semibold text-primary hover:opacity-80">
            Terms
          </Link>
          <Link href="/" className="font-semibold text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </article>
    </main>
  )
}
