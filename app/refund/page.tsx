import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund Policy | DropVerse',
  description: 'DropVerse refund, cancellation, revision, and digital-deliverable policy.',
}

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-[#071f1d] px-5 py-16 text-[#d9e0dc]">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">Back to DropVerse</Link>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-white">Refund Policy</h1>
        <p className="mt-3 text-sm text-[#849792]">Last updated 12 October 2026. Contact dropverseagency@gmail.com.</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-[#c5d2cc]">
          <p>DropVerse provides B2B workspace software for digital teams managing projects and client operations. This policy explains when a payment may be cancelled, refunded, or revised. It applies to DropVerse platform plans and software plans and platform transactions processed through a DropVerse checkout.</p>
          <h2 className="font-display text-xl font-bold text-white">Platform plan cancellations</h2>
          <p>You may cancel a recurring DropVerse plan at any time through the Dodo Payments customer portal or by contacting us. Cancellation stops future renewals; access normally remains available through the paid billing period. A renewal that has already been processed is not automatically reversed, but we will review exceptional cases in good faith.</p>
          <h2 className="font-display text-xl font-bold text-white">14-day satisfaction review</h2>
          <p>For a first-time paid DropVerse platform plan, contact us within 14 calendar days of the initial charge if the service is materially different from the plan description. We may issue a full or partial refund after reviewing account use, deliverables, and any applicable Dodo Payments transaction fees. This review is not a guarantee of a refund for completed or heavily used services.</p>
          <h2 className="font-display text-xl font-bold text-white">Digital workflow purchases</h2>
          <p>Client orders are digital deliverables. If a deliverable is incomplete, materially inconsistent with the agreed brief, or technically unusable, notify the seller within 7 days of delivery with specific details. The seller may provide a reasonable revision first. If the issue cannot be corrected within the agreed scope, DropVerse may approve a partial or full refund.</p>
          <h2 className="font-display text-xl font-bold text-white">Non-refundable situations</h2>
          <p>Refunds generally do not apply to approved work that matches the brief, changes of mind after work has started, delays caused by missing client materials or feedback, third-party advertising spend, or work delivered outside the DropVerse checkout. Fraudulent, abusive, duplicate, or chargeback-related activity may suspend an account while it is reviewed.</p>
          <h2 className="font-display text-xl font-bold text-white">How to request a refund</h2>
          <p>Email dropverseagency@gmail.com with your name, account email, Dodo Payments transaction ID or invoice ID, purchase date, and a clear description of the issue. We aim to acknowledge requests within 3 business days and normally complete an approved refund through the original payment method. Dodo Payments may display the refund timing separately depending on the payment method and bank.</p>
          <h2 className="font-display text-xl font-bold text-white">Payment provider</h2>
          <p>Payments and refunds may be processed by Dodo Payments as our authorized payment provider. Dodo Payments may apply its own payment-method rules, tax handling, and processing timelines. Nothing in this policy limits rights that cannot legally be waived under applicable consumer-protection law.</p>
        </div>
      </article>
    </main>
  )
}
