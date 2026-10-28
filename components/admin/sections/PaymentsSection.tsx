'use client'
import { Badge, Card, LoadingOrError, StatCard, fmtDate, fmtUsd, adminMutate, useAdminData } from '@/components/admin/shared'
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

type PayoutRequestRow = {
  id: string
  user_id: string
  amount: number | string
  status: string
  method?: string | null
  destination?: string | null
  dropverse_fee?: number | string | null
  estimated_net?: number | string | null
  requested_at: string
  reviewed_at?: string | null
  paid_at?: string | null
  transfer_reference?: string | null
  admin_note?: string | null
  profile?: { full_name?: string | null; username?: string | null } | null
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

function PayoutRequestsTable({ rows }: { rows: PayoutRequestRow[] }) {
  async function updateStatus(row: PayoutRequestRow, newStatus: 'approved' | 'paid' | 'cancelled') {
    if (!window.confirm(`Change payout ${row.id.slice(0, 8)} to ${newStatus}?`)) return
    let reference: string | undefined
    let adminNote: string | undefined
    if (newStatus === 'paid') {
      reference = window.prompt('Enter the PayPal transaction ID or bank transfer reference:')?.trim()
      if (!reference) {
        alert('A transfer reference is required before marking a payout as paid.')
        return
      }
    }
    if (newStatus === 'cancelled') {
      adminNote = window.prompt('Optional cancellation note (the reserved balance will be released):')?.trim() || undefined
    }
    const result = await adminMutate('set_payout', {
      payoutId: row.id,
      newStatus,
      reference,
      adminNote,
    })
    if (result.error) {
      alert(String(result.message || result.error))
      return
    }
    window.location.reload()
  }

  return (
    <Card title={`Withdrawal requests (${rows.length})`}>
      <p className="mb-3 text-xs leading-5 text-[#81948e]">
        Review requests manually. Approving does not send money. Before marking one Paid, complete the transfer and record its provider / bank reference. Cancelled requests release the reserved balance.
      </p>
      {!rows.length ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-6 text-center text-xs text-[#7f918c]">No withdrawal requests yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                <th className="py-2 pl-3 pr-3 font-semibold">User / Date</th>
                <th className="py-2 pr-3 font-semibold">Gross</th>
                <th className="py-2 pr-3 font-semibold">Method / Destination</th>
                <th className="py-2 pr-3 font-semibold">Fee / Net</th>
                <th className="py-2 pr-3 font-semibold">Status / Transfer reference</th>
                <th className="py-2 pr-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-white/5 align-top last:border-0">
                  <td className="py-3 pl-3 pr-3">
                    <div className="font-semibold text-[#f0f4f2]">{p.profile?.full_name || p.profile?.username || 'DropVerse user'}</div>
                    <div className="font-mono text-[10px] text-[#81948e]">{p.user_id.slice(0, 8)}…</div>
                    <div className="mt-1 text-[10px] text-[#81948e]">{fmtDate(p.requested_at)}</div>
                  </td>
                  <td className="py-3 pr-3 font-semibold text-[#f0f4f2]">{fmtUsd(Number(p.amount) || 0)}</td>
                  <td className="py-3 pr-3">
                    <div className="text-xs font-semibold text-[#e4c979]">{p.method || '—'}</div>
                    <div className="mt-1 max-w-[15rem] break-all text-xs text-[#9aacb8]">{p.destination || 'No destination supplied'}</div>
                  </td>
                  <td className="py-3 pr-3 text-xs text-[#c8d4d0]">
                    <div>Fee: {fmtUsd(Number(p.dropverse_fee) || 0)}</div>
                    <div className="mt-1">Net: {fmtUsd(Number(p.estimated_net) || 0)}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge status={p.status} label={p.status} />
                    {p.transfer_reference ? <div className="mt-2 max-w-[15rem] break-all text-[10px] text-[#9aacb8]">Ref: {p.transfer_reference}</div> : null}
                    {p.admin_note ? <div className="mt-1 max-w-[15rem] text-[10px] text-[#9aacb8]">Note: {p.admin_note}</div> : null}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap gap-1.5">
                      {p.status === 'pending' ? (
                        <button onClick={() => updateStatus(p, 'approved')} className="rounded-lg border border-emerald-400/30 px-2.5 py-1 text-xs font-bold text-emerald-200 hover:bg-emerald-400/10">Approve</button>
                      ) : null}
                      {p.status === 'approved' ? (
                        <button onClick={() => updateStatus(p, 'paid')} className="rounded-lg border border-sky-400/30 px-2.5 py-1 text-xs font-bold text-sky-200 hover:bg-sky-400/10">Mark paid</button>
                      ) : null}
                      {p.status === 'pending' || p.status === 'approved' ? (
                        <button onClick={() => updateStatus(p, 'cancelled')} className="rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-bold text-red-200 hover:bg-red-400/10">Cancel</button>
                      ) : null}
                    </div>
                  </td>
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

          {(data.paddleError || data.invoicesError || data.payoutsError) ? (
            <div className="rounded-lg border border-[rgba(230,190,90,0.35)] bg-[rgba(230,190,90,0.08)] px-4 py-3 text-xs text-[#f0d98b]">
              {data.paddleError ? <div>Paddle orders: {String(data.paddleError)}</div> : null}
              {data.invoicesError ? <div>Invoices: {String(data.invoicesError)}</div> : null}
              {data.payoutsError ? <div>Payout requests: {String(data.payoutsError)}</div> : null}
            </div>
          ) : null}

          <PayoutRequestsTable rows={(data.payoutRequests ?? []) as PayoutRequestRow[]} />
          <PaddleOrdersTable rows={(data.paddleOrders ?? []) as PaddleOrder[]} />
          <InvoicesTable rows={(data.invoices ?? []) as InvoiceRow[]} />

          <BucketTable title="Pending confirmation" icon={<Clock size={15} />} rows={(data.pending ?? []) as ProjectRow[]} />
          <BucketTable title="Confirmed" icon={<CheckCircle2 size={15} />} rows={(data.confirmed ?? []) as ProjectRow[]} />
          <BucketTable title="Failed" icon={<XCircle size={15} />} rows={(data.failed ?? []) as ProjectRow[]} />
          <BucketTable title="Disputed" icon={<AlertTriangle size={15} />} rows={(data.disputed ?? []) as ProjectRow[]} />

          <p className="text-xs leading-5 text-[#9aacb8]">
            Withdrawal requests are reviewed manually above. Mark a request Paid only after the transfer is complete and its reference has been recorded.
          </p>
        </div>
      ) : null}
    </div>
  )
}
