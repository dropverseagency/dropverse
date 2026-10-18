'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type TrackData = {
  status: string
  lifecycle: string | null
  title: string
  lastUpdate: string
  events: Array<{ status: string; at: string; note: string | null }>
}

export default function TrackOrderPage() {
  const params = useParams()
  const token = String(params?.token || '')
  const [data, setData] = useState<TrackData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/track/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not_found')
        return r.json()
      })
      .then(setData)
      .catch(() => setError('Order not found'))
  }, [token])

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-primary">DropVerse</p>
        <h1 className="mt-2 text-2xl font-bold">Order tracking</h1>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {!error && !data && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
        {data && (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Title</p>
              <p className="font-medium">{data.title}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="font-semibold text-primary">{data.lifecycle || data.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last update</p>
              <p className="text-sm">{new Date(data.lastUpdate).toLocaleString()}</p>
            </div>
            {data.events?.length > 0 && (
              <ol className="mt-4 space-y-2 border-t border-border pt-4">
                {data.events.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{e.status}</span>
                    <span className="text-muted-foreground"> · {new Date(e.at).toLocaleString()}</span>
                    {e.note ? <span className="block text-xs text-muted-foreground">{e.note}</span> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
