import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | DropVerse',
  description: 'Terms for using the DropVerse B2B SaaS workspace platform, plans, software features, and project workflows.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#071f1d] px-5 py-16 text-[#d9e0dc]">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">Back to DropVerse</Link>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-white">Terms of Service</h1>
        <p className="mt-3 text-sm text-[#849792]">Last updated 12 October 2026. Contact dropverseagency@gmail.com.</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-[#c5d2cc]">
          <p>These Terms of Service govern your use of DropVerse, a B2B SaaS workspace that helps digital teams organize projects, client operations, reusable assets, software workflows, and team collaboration. By creating an account or using a paid feature, you agree to these terms.</p>
          <h2 className="font-display text-xl font-bold text-white">Eligibility and accounts</h2>
          <p>You must provide accurate information, use an email address you control, and keep your credentials secure. You are responsible for activity under your account. One person may not create duplicate accounts to bypass limits, referral rules, or payment decisions. We may suspend or close accounts used for fraud, spam, impersonation, unlawful activity, abuse of payment systems, or interference with the platform.</p>
          <h2 className="font-display text-xl font-bold text-white">B2B SaaS workspace</h2>
          <p>DropVerse provides tools and marketplace-style information. A work sample or service format is not a promise that a sale, freelancer, delivery date, or business result will occur. When you use the workspace for client operations, you remain responsible for your communications, permissions, deadlines, taxes, and final approval of your work.</p>
          <h2 className="font-display text-xl font-bold text-white">Projects and digital workflows</h2>
          <p>Before ordering, review the service description, scope, price, delivery estimate, and required client materials. Digital deliverables may require revisions within the agreed scope. You must not use a deliverable to infringe copyright, privacy, publicity, trademark, confidentiality, or other rights. Details of cancellations and refunds are described in our <Link href="/refund" className="text-[#e4c979] underline underline-offset-4">Refund Policy</Link>.</p>
          <h2 className="font-display text-xl font-bold text-white">Plans and payment</h2>
          <p>Starter is free. Paid plan names, features, and prices are shown on <Link href="/pricing" className="text-[#e4c979] underline underline-offset-4">Pricing</Link>. Paid subscriptions renew according to the checkout terms until cancelled. Dodo Payments may process payments, taxes, receipts, renewals, and refunds as our authorized payment provider. We do not store full card numbers. Access to paid features may be limited or suspended after failed payment.</p>
          <h2 className="font-display text-xl font-bold text-white">Referrals and payouts</h2>
          <p>Referral rewards are calculated only on eligible, verified activity under the current program rules. Self-referrals, misleading promotion, spam, and duplicate attribution do not qualify. Earnings are not guaranteed. Payouts may be reviewed for fraud, refunds, chargebacks, and compliance before release.</p>
          <h2 className="font-display text-xl font-bold text-white">Acceptable use</h2>
          <p>You may not reverse engineer the service, scrape private data, upload malware, bypass security, submit false payment details, distribute unlawful content, or use DropVerse to facilitate fraud or harassment. We may remove content and limit access when reasonably necessary to protect users, providers, or the platform.</p>
          <h2 className="font-display text-xl font-bold text-white">Disclaimers and liability</h2>
          <p>The platform is provided on an as-available basis. We do not guarantee uninterrupted access, a particular revenue level, client acquisition, freelancer availability, or business outcome. To the maximum extent permitted by law, DropVerse is not liable for indirect, incidental, special, or consequential loss. Nothing here excludes liability that cannot legally be excluded.</p>
          <h2 className="font-display text-xl font-bold text-white">Changes and contact</h2>
          <p>We may update these terms when the service, law, or payment architecture changes. Material changes will be posted on this page. Questions, complaints, and legal notices should be sent to dropverseagency@gmail.com.</p>
        </div>
      </article>
    </main>
  )
}
