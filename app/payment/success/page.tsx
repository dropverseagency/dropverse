import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { adminClient } from '@/lib/adminCore'
import { paddleApiBase } from '@/lib/paddle'

async function confirmFromTransactionId(transactionId: string) {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey || !transactionId.startsWith('txn_')) return { paid: false as const }

  try {
    const txnRes = await fetch(`${paddleApiBase()}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Paddle-Version': '1' },
      cache: 'no-store',
    })
    const txnPayload = await txnRes.json().catch(() => ({}))
    if (!txnRes.ok) return { paid: false as const }

    const transaction = (txnPayload as {
      data?: {
        id?: string
        status?: string
        customer_id?: string
        subscription_id?: string
        custom_data?: {
          dropverse_organization_id?: string
          dropverse_plan_id?: string
          dropverse_invoice_id?: string
          dropverse_project_id?: string
        }
      }
    }).data

    if (!transaction?.id) return { paid: false as const }
    const status = String(transaction.status || '').toLowerCase()
    const isPaid = status === 'completed' || status === 'paid' || status === 'billed'
    if (!isPaid) return { paid: false as const, status: transaction.status }

    const admin = adminClient()
    const custom = transaction.custom_data || {}

    await admin.from('paddle_orders').update({
      status: 'completed',
      customer_id: transaction.customer_id ?? null,
      subscription_id: transaction.subscription_id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('transaction_id', transaction.id)

    if (custom.dropverse_organization_id && custom.dropverse_plan_id) {
      await admin
        .from('organizations')
        .update({ plan: custom.dropverse_plan_id, updated_at: new Date().toISOString() })
        .eq('id', custom.dropverse_organization_id)
    }

    if (custom.dropverse_invoice_id) {
      await admin
        .from('invoices')
        .update({ status: 'PAID' })
        .eq('id', custom.dropverse_invoice_id)
        .eq('status', 'PENDING')
    }

    if (custom.dropverse_project_id) {
      await admin
        .from('projects')
        .update({
          payment_status: 'PAYMENT_CONFIRMED',
          payment_provider: 'PADDLE',
          payment_transaction_id: transaction.id,
          payment_confirmed_at: new Date().toISOString(),
          status: 'PAYMENT_CONFIRMED',
        })
        .eq('id', custom.dropverse_project_id)
        .eq('payment_status', 'PAYMENT_PENDING')
    }

    return { paid: true as const, projectId: custom.dropverse_project_id ?? null, invoiceId: custom.dropverse_invoice_id ?? null }
  } catch {
    return { paid: false as const }
  }
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ transaction_id?: string }>
}) {
  const params = await searchParams
  const transactionId = params.transaction_id || ''
  const result = transactionId ? await confirmFromTransactionId(transactionId) : { paid: false as const }

  return (
    <main className="grid-bg flex min-h-screen items-center justify-center px-5 py-16">
      <section className="card w-full max-w-xl rounded-[28px] p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(111,191,115,0.40)] bg-[rgba(111,191,115,0.12)] text-[#7fd8a8]">
          <CheckCircle2 size={32} />
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#d8b45a]">DropVerse order received</p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-white sm:text-4xl">
          {result.paid ? 'Payment confirmed.' : 'Payment submitted successfully.'}
        </h1>
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
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-5 py-3 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]">
            View dashboard <ArrowRight size={15} />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-[#d9e0dc] hover:border-[rgba(216,180,90,0.40)]">
            Back to DropVerse
          </Link>
        </div>
      </section>
    </main>
  )
}
