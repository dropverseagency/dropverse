import Link from 'next/link'
import { notFound } from 'next/navigation'
import InvoicePayForm from './InvoicePayForm'
import CopyLinkButton from './CopyLinkButton'
import { createServiceClient } from '@/lib/supabaseService'

/**
 * Public invoice page — server-rendered, no login required.
 * Service details + amount are resolved on the server; only the
 * payment form is a small client component.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await loadInvoice(id)
  if (!data) notFound()

  const due = formatCurrency(data.invoice.amount, data.invoice.currency)

  return (
    <div className="min-h-screen grid-bg px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-[#0a2926] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b45a] font-display text-sm font-black text-[#10221f]">
                    DV
                  </span>
                </Link>
                <span className="font-display text-xl font-bold tracking-[.06em] text-[#d9e0dc]">
                  DROP<span className="text-[#d8b45a]">VERSE</span>
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#687d76]">Invoice</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[#e4c979]">{data.invoice.invoiceNumber}</div>
              <div className="mt-1.5 flex items-center justify-end gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6fbf73]" />
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#6fbf73]">
                  {data.invoice.status === 'PAID' ? 'Paid' : data.invoice.canPay ? 'Awaiting payment' : data.invoice.status}
                </span>
              </div>
            </div>
          </div>

          {(data.invoice.clientName || data.invoice.clientEmail) && (
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[.02] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#687d76]">Billed to</div>
              <div className="mt-1 text-sm font-semibold text-[#d9e0dc]">{data.invoice.clientName || '—'}</div>
              {data.invoice.clientEmail && <div className="text-xs text-[#687d76]">{data.invoice.clientEmail}</div>}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-white/5 bg-white/[.02] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#687d76]">Service</div>
            <h1 className="mt-1.5 font-display text-xl font-bold text-[#d9e0dc]">{data.invoice.service.title}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#aebcb7]">
              {data.invoice.service.description || 'No description provided.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[11px] font-semibold text-[#849792]">
                {data.invoice.service.category || 'Service'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[11px] font-semibold text-[#849792]">
                {typeLabel(data.invoice.service.projectType)}
              </span>
            </div>
            {data.invoice.service.deliveryNotes && (
              <p className="mt-4 border-t border-white/5 pt-3 text-xs text-[#687d76]">
                <span className="font-semibold text-[#8fa29c]">Delivery notes: </span>
                {data.invoice.service.deliveryNotes}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.05)] px-5 py-4">
            <span className="text-sm font-bold uppercase tracking-[.12em] text-[#cfd8d3]">Total due</span>
            <span className="font-display text-2xl font-black text-[#f0d98b]">{due}</span>
          </div>

          {data.invoice.status === 'PAID' ? (
            <div className="mt-6 rounded-2xl border border-[rgba(111,191,115,0.40)] bg-[rgba(111,191,115,0.08)] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(111,191,115,0.45)] bg-[rgba(111,191,115,0.15)]">
                <CheckIcon />
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-[#6fbf73]">This invoice is paid</h2>
              <p className="mt-1.5 text-sm text-[#aebcb7]">Thank you! The seller has been notified and your service will be delivered as agreed.</p>
            </div>
          ) : !data.invoice.canPay ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-6 text-center">
              <h2 className="mt-1 font-display text-lg font-bold text-[#d9e0dc]">This invoice is no longer payable</h2>
              <p className="mt-1.5 text-sm text-[#687d76]">Please contact the seller for an updated invoice.</p>
            </div>
          ) : (
            <InvoicePayForm invoiceId={data.invoice.id} due={due} />
          )}

          <div className="mt-6 flex items-center justify-between rounded-xl border border-white/5 bg-white/[.02] px-4 py-3">
            <div className="min-w-0 text-xs text-[#687d76]">
              <span className="font-semibold text-[#8fa29c]">Seller? </span>
              Share this link with your client to collect payment.
            </div>
            <CopyLinkButton />
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#536963]">
          Powered by <span className="text-[#687d76]">DropVerse</span> · Payments processed by SpaceRemit
        </p>
      </div>
    </div>
  )
}

interface PublicInvoice {
  id: string
  invoiceNumber: string
  clientName: string | null
  clientEmail: string | null
  currency: string
  amount: number
  status: string
  service: {
    projectId: string
    title: string
    description: string
    category: string
    projectType: string
    deliveryNotes: string
  }
  canPay: boolean
}

async function loadInvoice(id: string): Promise<{ invoice: PublicInvoice } | null> {
  let db: ReturnType<typeof createServiceClient>
  try {
    db = createServiceClient()
  } catch {
    return null
  }
  const { data, error } = await db
    .from('invoices')
    .select(
      `
      id,
      invoice_number,
      client_name,
      client_email,
      currency,
      amount,
      status,
      project:project_id!inner (
        id, title, description, category, project_type, delivery_notes
      )
    `,
    )
    .eq('id', id)
    .single()

  if (error || !data) return null
  const inv = data as unknown as {
    id: string
    invoice_number: string
    client_name: string | null
    client_email: string | null
    currency: string
    amount: number
    status: string
    project: {
      id: string
      title: string
      description: string
      category: string
      project_type: string
      delivery_notes: string
    }
  }
  return {
    invoice: {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      clientName: inv.client_name,
      clientEmail: inv.client_email,
      currency: inv.currency,
      amount: Number(inv.amount),
      status: inv.status,
      service: {
        projectId: inv.project.id,
        title: inv.project.title,
        description: inv.project.description,
        category: inv.project.category,
        projectType: inv.project.project_type,
        deliveryNotes: inv.project.delivery_notes,
      },
      canPay: inv.status === 'PENDING',
    },
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'ONE_TIME': return 'One-time'
    case 'MONTHLY': return 'Monthly'
    case 'ANNUAL': return 'Annual'
    case 'CUSTOM_RECURRING': return 'Recurring'
    default: return type || 'Service'
  }
}

function formatCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(n || 0)
  } catch {
    return `$${Math.round(n || 0).toLocaleString()}`
  }
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6fbf73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

