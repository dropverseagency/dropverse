'use client'
import { Badge, Card, LoadingOrError, StatCard, fmtDate, fmtUsd, useAdminData } from '@/components/admin/shared'
import { Clock, CheckCircle2, XCircle, AlertTriangle, CreditCard, FileText, ExternalLink } from 'lucide-react'

type ProjectRow = {
  id: string
  title: string
  client_price: string | number
  payment_method: string
  payment_status: string
  payment_provider?: string | null
  payment_confirmed_at?: string
  payment_transaction_id?: string | null
  created_at: string
}

type PaddleOrder = {
  id: string
  transaction_id: string
  user_id?: string | null
  status: string
  amount: number | string
  currency_code?: string
  customer_email?: string | null
  plan_id?: string | null
  sample_id?: string | null
  organization_id?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

type InvoiceRow = {
  id: string
  invoice_number: string
  amount: number | string
  currency?: string
  status: string
  client_name?: string | null
  client_email?: string | null
  project_id?: string | null
  created_at: string
}

function statusTone(status: string) {
  const s = status.toUpperCase()
  if (s.includes('CONFIRM') || s === 'PAID' || s === 'COMPLETED' || s === 'BILLED') return 'PAYMENT_CONFIRMED'
  if (s.includes('PENDING') || s === 'DRAFT' || s === 'READY') return 'PAYMENT_PENDING'
  if (s.includes('FAIL') || s === 'CANCELED' || s === 'CANCELLED') return 'PAYMENT_FAILED'
  if (s.includes('DISPUTE')) return 'PAYMENT_DISPUTED'
  return status
}

function sourceLabel(meta: Record<string, unknown> | null | undefined, order: PaddleOrder) {
  const source = String(meta?.source || '')
  if (source === 'create_project' || meta?.project_id) return 'Project checkout'
  if (source === 'public_invoice' || meta?.invoice_id) return 'Client invoice'
  if (source === 'pricing_or_billing' || order.plan_id) return 'Plan / subscription'
  if (source === 'sample_card' || order.sample_id) return 'Sample order'
  if (source) return source
  return 'Paddle'
}

function BucketTable({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: ProjectRow[] }) {
  return (
    <Card title={`${title} (${rows.length})`}>
      <div className="mb-3 flex items-center gap-2 text-[#f0d98b]">{icon}<span className="text-xs font-bold uppercase tracking-wider">{title}</span></div>
      {!rows.length ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-6 text-center text-xs text-[#7f918c]">Nothing in this group.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                <th className="py-2 pl-3 pr-3 font-semibold">Project</th>
                <th className="py-2 pr-3 font-semibold">Amount</th>
                <th className="py-2 pr-3 font-semibold">Method</th>
                <th className="py-2 pr-3 font-semibold">Provider</th>
                <th className="py-2 pr-3 font-semibold">Txn / Date</th>
                <th className="py-2 pl-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pl-3 pr-3 font-semibold text-[#f0f4f2]">{p.title}</td>
                  <td className="py-2.5 pr-3 text-[#c8d4d0]">{fmtUsd(Number(p.client_price) || 0)}</td>
                  <td className="py-2.5 pr-3 text-xs text-[#7f918c]">{p.payment_method || '—'}</td>
                  <td className="py-2.5 pr-3 text-xs text-[#9aacb8]">{p.payment_provider || '—'}</td>
                  <td className="py-2.5 pr-3 text-xs text-[#7f918c]">
                    <div>{fmtDate(p.payment_confirmed_at ?? p.created_at)}</div>
                    {p.payment_transaction_id ? (
                      <div className="mt-0.5 font-mono text-[10px] text-[#e4c979]">{p.payment_transaction_id}</div>
                    ) : null}
                  </td>
                  <td className="py-2.5 pl-3"><Badge status={statusTone(p.payment_status)} label={p.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function PaddleOrdersTable({ rows }: { rows: PaddleOrder[] }) {
  return (
    <Card title={`Paddle orders (${rows.length})`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#f0d98b]">
          <CreditCard size={15} />
          <span className="text-xs font-bold uppercase tracking-wider">International payments (Paddle)</span>
        </div>
        <a
          href="https://sandbox-vendors.paddle.com/transactions-v2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-3 py-1.5 text-[11px] font-bold text-[#e4c979] hover:bg-[rgba(216,180,90,0.14)]"
        >
          Open Paddle Sandbox <ExternalLink size={12} />
        </a>
      </div>
      {!rows.length ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-6 text-center text-xs text-[#7f918c]">
          No Paddle orders yet. Completed sandbox checkouts will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                <th className="py-2 pl-3 pr-3 font-semibold">Transaction</th>
                <th className="py-2 pr-3 font-semibold">Amount</th>
                <th className="py-2 pr-3 font-semibold">Source</th>
                <th className="py-2 pr-3 font-semibold">Customer</th>
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pl-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const meta = (o.metadata || {}) as Record<string, unknown>
                const st = String(o.status || '')
                return (
                  <tr key={o.id || o.transaction_id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pl-3 pr-3">
                      <div className="font-mono text-xs text-[#e4c979]">{o.transaction_id}</div>
                      {meta.project_title ? <div className="mt-0.5 text-[11px] text-[#9aacb8]">{String(meta.project_title)}</div> : null}
                      {meta.invoice_number ? <div className="mt-0.5 text-[11px] text-[#9aacb8]">Invoice {String(meta.invoice_number)}</div> : null}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-[#c8d4d0]">{fmtUsd(Number(o.amount) || 0)}</td>
                    <td className="py-2.5 pr-3 text-xs text-[#9aacb8]">{sourceLabel(meta, o)}</td>
                    <td className="py-2.5 pr-3 text-xs text-[#7f918c]">{o.customer_email || '—'}</td>
                    <td className="py-2.5 pr-3 text-xs text-[#7f918c]">{fmtDate(o.updated_at || o.created_at)}</td>
                    <td className="py-2.5 pl-3"><Badge status={statusTone(st)} label={st || '—'} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  return (
    <Card title={`Invoices (${rows.length})`}>
      <div className="mb-3 flex items-center gap-2 text-[#f0d98b]">
        <FileText size={15} />
        <span className="text-xs font-bold uppercase tracking-wider">Client invoices</span>
      </div>
      {!rows.length ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-6 text-center text-xs text-[#7f918c]">No invoices yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                <th className="py-2 pl-3 pr-3 font-semibold">Invoice</th>
                <th className="py-2 pr-3 font-semibold">Client</th>
                <th className="py-2 pr-3 font-semibold">Amount</th>
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Link</th>
                <th className="py-2 pl-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pl-3 pr-3 font-mono text-xs font-semibold text-[#e4c979]">{inv.invoice_number}</td>
                  <td className="py-2.5 pr-3 text-xs text-[#c8d4d0]">
                    <div>{inv.client_name || '—'}</div>
                    {inv.client_email ? <div className="text-[#7f918c]">{inv.client_email}</div> : null}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-[#c8d4d0]">{fmtUsd(Number(inv.amount) || 0)}</td>
                  <td className="py-2.5 pr-3 text-xs text-[#7f918c]">{fmtDate(inv.created_at)}</td>
                  <td className="py-2.5 pr-3">
                    <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#d8b45a] hover:underline">
                      Open
                    </a>
                  </td>
                  <td className="py-2.5 pl-3"><Badge status={statusTone(inv.status)} label={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default function PaymentsSection() {
  const { data, loading, error } = useAdminData('payments')

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Confirmed projects" value={fmtUsd(Number(data.confirmedVolume || 0))} sub={`${(data.confirmed ?? []).length} projects`} />
            <StatCard label="Pending projects" value={fmtUsd(Number(data.pendingVolume || 0))} sub={`${(data.pending ?? []).length} projects`} />
            <StatCard label="Paddle completed" value={fmtUsd(Number(data.paddleCompletedVolume || 0))} sub={`${data.paddleCompletedCount ?? 0} orders`} />
            <StatCard label="Invoices paid" value={fmtUsd(Number(data.invoicesPaidVolume || 0))} sub={`${data.invoicesPaidCount ?? 0} paid · ${data.invoicesOpenCount ?? 0} open`} />
          </div>

          {(data.paddleError || data.invoicesError) ? (
            <div className="rounded-lg border border-[rgba(230,190,90,0.35)] bg-[rgba(230,190,90,0.08)] px-4 py-3 text-xs text-[#f0d98b]">
              {data.paddleError ? <div>Paddle orders: {String(data.paddleError)}</div> : null}
              {data.invoicesError ? <div>Invoices: {String(data.invoicesError)}</div> : null}
            </div>
          ) : null}

          <PaddleOrdersTable rows={(data.paddleOrders ?? []) as PaddleOrder[]} />
          <InvoicesTable rows={(data.invoices ?? []) as InvoiceRow[]} />

          <BucketTable title="Pending confirmation" icon={<Clock size={15} />} rows={(data.pending ?? []) as ProjectRow[]} />
          <BucketTable title="Confirmed" icon={<CheckCircle2 size={15} />} rows={(data.confirmed ?? []) as ProjectRow[]} />
          <BucketTable title="Failed" icon={<XCircle size={15} />} rows={(data.failed ?? []) as ProjectRow[]} />
          <BucketTable title="Disputed" icon={<AlertTriangle size={15} />} rows={(data.disputed ?? []) as ProjectRow[]} />

          <p className="text-xs leading-5 text-[#9aacb8]">
            Sandbox test payments appear here after checkout completes. Real money only appears after you switch to live Paddle credentials.
            This page auto-refreshes every 20 seconds.
          </p>
        </div>
      ) : null}
    </div>
  )
}
