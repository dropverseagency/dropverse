'use client'
import { useState } from 'react'
import { Badge, Card, LoadingOrError, fmtDate, emptyNote, fmtUsd, useAdminData } from '@/components/admin/shared'
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

type Bucket = { id: string; title: string; client_price: string | number; payment_method: string; payment_status: string; payment_confirmed_at?: string; created_at: string }

function BucketTable({ title, icon, rows, showConfirm }: { title: string; icon: React.ReactNode; rows: Bucket[]; showConfirm?: boolean }) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 font-display text-sm font-extrabold tracking-wide text-[#f0d98b]">
        {icon} {title} ({rows.length})
      </h3>
      {!rows.length ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-4 text-center text-xs text-[#7f918c]">Nothing in this group.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-[#7f918c]">
                <th className="py-2 pl-3 pr-3 font-semibold">Project</th>
                <th className="py-2 pr-3 font-semibold">Amount</th>
                <th className="py-2 pr-3 font-semibold">Method</th>
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pl-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pl-3 pr-3 font-semibold text-[#f0f4f2]">{p.title}</td>
                  <td className="py-2.5 pr-3 text-[#c8d4d0]">{fmtUsd(Number(p.client_price) || 0)}</td>
                  <td className="py-2.5 pr-3 text-xs text-[#7f918c]">{p.payment_method || '—'}</td>
                  <td className="py-2.5 pr-3 text-xs text-[#7f918c]">{fmtDate(p.payment_confirmed_at ?? p.created_at)}</td>
                  <td className="py-2.5 pl-3"><Badge status={p.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PaymentsSection() {
  const { data, loading, error } = useAdminData('payments')

  return (
    <div>
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}
      {data ? (
        <div className="space-y-6">
          <BucketTable title="Pending confirmation" icon={<Clock size={15} />} rows={data.pending ?? []} />
          <BucketTable title="Confirmed" icon={<CheckCircle2 size={15} />} rows={data.confirmed ?? []} />
          <BucketTable title="Failed" icon={<XCircle size={15} />} rows={data.failed ?? []} />
          <BucketTable title="Disputed" icon={<AlertTriangle size={15} />} rows={data.disputed ?? []} />
          <p className="text-xs text-[#7f918c]">No real payment processor is connected yet. Payments become "confirmed" manually via Confirm & Pay out on the Projects tab.</p>
        </div>
      ) : null}
    </div>
  )
}
