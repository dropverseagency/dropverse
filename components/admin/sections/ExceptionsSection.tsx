'use client'

import { useEffect, useState } from 'react'

type ExceptionRow = {
  kind: string
  id: string
  label: string
  detail?: string
}

export default function ExceptionsSection() {
  const [rows, setRows] = useState<ExceptionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/data?section=exceptions')
      .then(async (r) => {
        if (!r.ok) return { exceptions: [] }
        return r.json()
      })
      .then((j) => setRows(j.exceptions || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Exceptions</h2>
        <p className="text-sm text-muted-foreground">
          Only items that need your attention. Empty means the system is handling the rest.
        </p>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No exceptions right now.
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-primary">{r.kind}</p>
            <p className="font-medium">{r.label}</p>
            {r.detail ? <p className="text-sm text-muted-foreground">{r.detail}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
