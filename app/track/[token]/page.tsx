'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type TrackData = {
  status: string
  lifecycle: string | null
  title: string
  lastUpdate: string
  revisionsUsed?: number
  revisionsLimit?: number
  canRequestRevision?: boolean
  canApprove?: boolean
  canMarkDelivered?: boolean
  events: Array<{ status: string; at: string; note: string | null }>
}

export default function TrackOrderPage() {
  const params = useParams()
  const token = String(params?.token || '')
  const [data, setData] = useState<TrackData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!token) return
    fetch(`/api/track/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not_found')
        return r.json()
      })
      .then(setData)
      .catch(() => setError('Order not found'))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  async function act(action: string) {
    if (!token || busy) return
    setBusy(true)
    try {
      const r = await fetch(`/api/track/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setError(j.error || 'Action failed')
      else {
        setError(null)
        load()
      }
    } finally {
      setBusy(false)
    }
  }

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
            <p className="text-xs text-muted-foreground">
              Revisions: {data.revisionsUsed ?? 0} / {data.revisionsLimit ?? 2}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {data.canMarkDelivered && (
                <button type="button" disabled={busy} onClick={() => act('mark_delivered')} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  Mark delivered
                </button>
              )}
              {data.canApprove && (
                <button type="button" disabled={busy} onClick={() => act('approve')} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  Approve & complete
                </button>
              )}
              {data.canRequestRevision && (
                <button type="button" disabled={busy} onClick={() => act('request_revision')} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  Request revision
                </button>
              )}
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
