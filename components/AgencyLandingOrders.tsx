'use client'

import { useEffect, useState } from 'react'

type OrderRow = {
  projectId: string
  title: string
  status: string
  paymentStatus: string
  retailPrice: number
  currency: string
  customerName: string | null
  customerEmail: string | null
  createdAt: string
}

/** Displays agency landing orders without fulfillment costs. */
export default function AgencyLandingOrders({ organizationId }: { organizationId: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/agency/orders?organizationId=${encodeURIComponent(organizationId)}`)
      const json = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        setError(json.error || 'LOAD_FAILED')
        return
      }
      setOrders(json.orders || [])
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  return (
    <section className="card rounded-3xl p-6">
      <h2 className="font-display font-bold">Landing page orders</h2>
      <p className="mt-1 text-xs text-[#849792]">Retail amounts only. Fulfillment costs are not shown.</p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 space-y-2">
        {orders.length === 0 ? (
          <p className="text-sm text-[#849792]">No orders through this page yet.</p>
        ) : (
          orders.map((o) => (
            <div key={o.projectId} className="rounded-xl border border-white/10 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#d9e0dc]">{o.title}</span>
                <span className="text-xs text-[#849792]">
                  {o.currency} {Number(o.retailPrice).toLocaleString()} · {o.paymentStatus}
                </span>
              </div>
              <div className="mt-1 text-xs text-[#7f918c]">
                {o.customerName || 'Customer'} · {o.customerEmail || '—'} · {o.status}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
