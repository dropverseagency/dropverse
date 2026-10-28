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
        <p className="mt-3 text-sm text-[#849792]">Last updated 28 October 2026. Contact dropverseagency@gmail.com.</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-[#c5d2cc]">
          <p>This policy covers DropVerse subscriptions, digital services, and lead-pack purchases processed through a DropVerse checkout. Refund decisions consider the offer and description shown at purchase, transaction and delivery records, payment-provider rules, and applicable law. Nothing in this policy removes a right that cannot legally be waived.</p>
          <h2 className="font-display text-xl font-bold text-white">Platform plan cancellations</h2>
          <p>You may cancel a recurring DropVerse plan at any time through the payment provider's customer portal where available or by contacting us. Cancellation stops future renewals; access normally remains available through the paid billing period. A renewal that has already been processed is not automatically reversed, but we will review exceptional cases in good faith.</p>
          <h2 className="font-display text-xl font-bold text-white">14-day satisfaction review</h2>
          <p>For a first-time paid DropVerse platform plan, contact us within 14 calendar days of the initial charge if the service is materially different from the plan description. We may issue a full or partial refund after reviewing account use, deliverables, and any applicable payment-provider transaction fees. This review is not a guarantee of a refund for completed or heavily used services.</p>
          <h2 className="font-display text-xl font-bold text-white">Digital workflow purchases</h2>
          <p>Client orders are digital deliverables. If a deliverable is incomplete, materially inconsistent with the agreed brief, or technically unusable, notify the seller within 7 days of delivery with specific details. The seller may provide a reasonable revision first. If the issue cannot be corrected within the agreed scope, DropVerse may approve a partial or full refund.</p>
          <h2 className="font-display text-xl font-bold text-white">Non-refundable situations</h2>
          <p>Refunds generally do not apply to approved work that matches the brief, changes of mind after work has started, delays caused by missing client materials or feedback, third-party advertising spend, or work delivered outside the DropVerse checkout. Fraudulent, abusive, duplicate, or chargeback-related activity may suspend an account while it is reviewed.</p>
          <h2 className="font-display text-xl font-bold text-white">Lead packs and other digital files</h2>
          <p>Before purchase, review the pack’s stated fields, niche, countries, verification level, preview, and any restrictions. A pack is generally not refundable solely because a buyer changes their mind, does not obtain expected sales, or finds that leads do not convert, where the pack was delivered and materially matches its listing. Contact us promptly if the file cannot be accessed, is materially different from the listing, appears unlawfully sourced, or has another substantial defect. We may verify the purchase and delivery records and, where appropriate, provide corrected data, replacement access, a partial refund, or a full refund. Download or access logs may help confirm delivery but do not automatically defeat a valid claim.</p>
          <h2 className="font-display text-xl font-bold text-white">Subscriptions and renewals</h2>
          <p>Cancel a subscription before its next renewal to stop future charges. Unless a checkout offer or applicable law says otherwise, cancellation does not automatically refund a billing period that has already started. If you believe a renewal was unauthorized, duplicated, or charged after a valid cancellation, contact us with the transaction ID and relevant details so we can investigate. Any applicable statutory cancellation period or mandatory refund right takes precedence over this policy.</p>
          <h2 className="font-display text-xl font-bold text-white">Payment disputes</h2>
          <p>We retain relevant records such as receipts, transaction IDs, account and access events, download timestamps, file details, project briefs, delivery messages, and support correspondence to investigate payment questions and respond accurately to payment-provider disputes. We may provide relevant records to the payment processor or dispute reviewer. We cannot guarantee the outcome of a PayPal, card, bank, or other provider dispute, and we do not ask buyers to waive legitimate dispute rights. Please contact us promptly about an issue so we have an opportunity to investigate, without limiting your right to contact your payment provider.</p>
          <h2 className="font-display text-xl font-bold text-white">How to request a refund</h2>
          <p>Email dropverseagency@gmail.com with your name, account email, Dodo Payments transaction ID or invoice ID, purchase date, and a clear description of the issue. We aim to acknowledge requests within 3 business days and normally complete an approved refund through the original payment method. The payment provider may display the refund timing separately depending on the payment method and bank.</p>
          <h2 className="font-display text-xl font-bold text-white">Payment provider</h2>
          <p>Payments and refunds may be processed by PayPal, Paddle, SpaceRemit, or another provider displayed at checkout. Each provider may apply its own payment-method rules, tax handling, dispute process, and processing timelines. Nothing in this policy limits rights that cannot legally be waived under applicable consumer-protection law.</p>
        </div>
      </article>
    </main>
  )
}
