import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | DropVerse',
  description: 'How DropVerse handles account, project, referral, cookie, and payment data.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#071f1d] px-5 py-16 text-[#d9e0dc]">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">Back to DropVerse</Link>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#849792]">Last updated 12 October 2026. Contact dropverseagency@gmail.com.</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-[#c5d2cc]">
          <p>This Privacy Policy explains how DropVerse handles personal information when you visit our website, create an account, use a workspace, order a service, or contact us. It is intended to describe our practices for applicable privacy laws, including GDPR-style data-protection principles and applicable CCPA/CPRA rights. It is not a substitute for advice about your specific legal obligations.</p>
          <h2 className="font-display text-xl font-bold text-white">Information we collect</h2>
          <p>Depending on how you use DropVerse, we may collect your name, email address, phone number, optional Telegram username, username, authentication details, workspace and team records, project information, client records, workspace activity, reusable assets, invoice information, referral codes, clicks, commissions, support messages, and payment status. Paddle receives the payment and billing information needed to process a transaction; DropVerse does not store full card numbers.</p>
          <h2 className="font-display text-xl font-bold text-white">How we use information</h2>
          <p>We use information to provide authentication, workspaces, services, invoices, referrals, customer support, fraud prevention, payment confirmation, security, troubleshooting, and service improvements. We may send transactional messages such as account verification, payment, security, and order updates. Marketing messages can be unsubscribed from where applicable.</p>
          <h2 className="font-display text-xl font-bold text-white">Legal bases and business purposes</h2>
          <p>Where GDPR applies, we generally rely on performance of a contract, legitimate interests in securing and improving the service, compliance with legal obligations, and consent where consent is required. Where CCPA/CPRA applies, we use data for business purposes such as providing the service, security, analytics, debugging, and customer support. We do not sell personal information or share it for cross-context behavioral advertising.</p>
          <h2 className="font-display text-xl font-bold text-white">Service providers</h2>
          <p>Supabase supports authentication and database storage. Vercel hosts and delivers the application. Paddle processes paid checkouts, subscriptions, receipts, taxes, and refunds. Email delivery may be provided through our authentication or transactional email configuration. These providers process information under their own terms and privacy notices and only for the services they provide to us.</p>
          <h2 className="font-display text-xl font-bold text-white">Cookies and similar technologies</h2>
          <p>DropVerse uses essential cookies or local storage needed for authentication, security, session continuity, and user preferences. Paddle may use cookies or similar technologies during checkout for fraud prevention, payment security, and checkout functionality. We do not intentionally use non-essential tracking cookies on the public marketing pages unless this notice is updated. Your browser can block cookies, but some account or checkout functions may stop working.</p>
          <h2 className="font-display text-xl font-bold text-white">Retention and security</h2>
          <p>We retain account, order, invoice, and financial records for as long as needed to provide the service, resolve disputes, prevent abuse, and meet legal or accounting requirements. We use access controls, authenticated sessions, row-level security where configured, encrypted transport, and provider security controls. No internet service can guarantee absolute security.</p>
          <h2 className="font-display text-xl font-bold text-white">Your privacy rights</h2>
          <p>Subject to applicable law, you may request access, correction, deletion, portability, restriction, objection, or withdrawal of consent. California residents may also request to know, correct, delete, or opt out of sale/sharing as applicable. Email dropverseagency@gmail.com from the address connected to your account and describe your request. We may verify identity before fulfilling it and will not discriminate against you for exercising a lawful right. You may also contact your local data-protection authority.</p>
          <h2 className="font-display text-xl font-bold text-white">International transfers and children</h2>
          <p>Our providers may process information in countries different from where you live and use appropriate contractual or other lawful safeguards where required. DropVerse is not directed to children under the minimum age required by applicable law. If you believe a child provided information, contact us so we can review and delete it where appropriate.</p>
          <h2 className="font-display text-xl font-bold text-white">Updates and contact</h2>
          <p>We may update this policy when our services, providers, or legal obligations change. The effective date above will change when we publish an update. Questions and privacy requests should be sent to dropverseagency@gmail.com.</p>
        </div>
      </article>
    </main>
  )
}
