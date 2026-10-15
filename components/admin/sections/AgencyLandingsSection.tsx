'use client'
import { useEffect, useState } from 'react'
import { Card, LoadingOrError } from '@/components/admin/shared'

type PageRow = {
  id: string
  slug: string
  display_name: string
  published: boolean
  organization_name: string | null
  organization_plan: string | null
  updated_at: string
}

type OrderRow = {
  id: string
  project_id: string
  retail_price: number
  currency: string
  customer_email: string | null
  created_at: string
}

export default function AgencyLandingsSection() {
  const [pages, setPages] = useState<PageRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/admin/agency-landings')
      const json = await res.json().catch(() => ({}))
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        setError(json.error || 'LOAD_FAILED')
        return
      }
      setPages(json.pages || [])
      setOrders(json.recentOrders || [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      {loading || error ? <LoadingOrError loading={loading} error={error} /> : null}

      <Card title="Agency landing pages">
        <p className="mb-4 text-sm text-[#8fa29c]">
          Paid-plan branded storefronts. Retail amounts only — fulfillment costs are never shown here.
        </p>
        <div className="space-y-2">
          {pages.length === 0 ? (
            <p className="text-sm text-[#849792]">No landing pages yet (or migration not applied).</p>
          ) : (
            pages.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold text-[#d9e0dc]">
                    {p.display_name}{' '}
                    <span className="text-xs font-normal text-[#849792]">/a/{p.slug}</span>
                  </div>
                  <div className="text-xs text-[#7f918c]">
                    {p.organization_name || 'Org'} · {p.organization_plan || '—'} ·{' '}
                    {p.published ? 'published' : 'draft'}
                  </div>
                </div>
                {p.published ? (
                  <a
                    href={`/a/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#d8b45a]"
                  >
                    Open
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card title="Recent agency orders">
        <div className="space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-[#849792]">No attributed agency orders yet.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-white/10 px-3 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-[#d9e0dc]">{o.customer_email || 'Customer'}</span>
                  <span className="text-xs text-[#849792]">
                    {o.currency} {Number(o.retail_price).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[#7f918c]">
                  Project {o.project_id.slice(0, 8)}… · {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
