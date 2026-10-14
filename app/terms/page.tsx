import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of use for the DropVerse platform.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-16 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-primary hover:opacity-80">
          Back to DropVerse
        </Link>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-foreground">Terms of use</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated 9 October 2026. Contact dropverseagency@gmail.com.
        </p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            By using DropVerse you agree to these terms. The platform provides workspace tools, service listings, and
            referral features for digital teams and sellers.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">Accounts</h2>
          <p>
            You are responsible for the accuracy of your profile data and for activity under your login. Keep your
            password confidential.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">Services & payments</h2>
          <p>
            Listings and projects must reflect real work. Online payment processing may be disabled until providers are
            fully configured; pending orders may be confirmed manually.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">Acceptable use</h2>
          <p>
            Do not abuse the platform, attempt unauthorized access, upload illegal content, or misrepresent services to
            clients.
          </p>
          <h2 className="font-display text-xl font-bold text-foreground">Limitation</h2>
          <p>
            DropVerse is provided as-is. We are not liable for indirect damages arising from use of the platform. These
            terms may be updated; continued use means acceptance of the current version.
          </p>
        </div>
        <div className="mt-10 flex gap-4 text-sm">
          <Link href="/privacy" className="font-semibold text-primary hover:opacity-80">
            Privacy
          </Link>
          <Link href="/" className="font-semibold text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </article>
    </main>
  )
}
