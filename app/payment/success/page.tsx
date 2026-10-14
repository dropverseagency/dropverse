import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ transaction_id?: string }> }) {
  const params = await searchParams
  const transactionId = params.transaction_id || ''

  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-5 py-16">
      <section className="card w-full max-w-xl rounded-[28px] p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(111,191,115,0.40)] bg-[rgba(111,191,115,0.12)] text-[#7fd8a8]">
          <CheckCircle2 size={32} />
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#d8b45a]">DropVerse order received</p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-white sm:text-4xl">Payment submitted successfully.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#9aaba6]">
          Dodo Payments has received your payment. We will update the order after the payment confirmation webhook is processed.
        </p>
        {transactionId && (
          <div className="mx-auto mt-7 max-w-md rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left">
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#687d76]">Transaction ID</div>
            <div className="mt-1 break-all font-mono text-xs text-[#e4c979]">{transactionId}</div>
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-5 py-3 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]">
            Back to DropVerse <ArrowRight size={15} />
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-[#d9e0dc] hover:border-[rgba(216,180,90,0.40)]">
            View dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}
