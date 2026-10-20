'use client'

import { useEffect, useState } from 'react'
import { Copy, CheckCircle2, Mail } from 'lucide-react'

type Row = {
  id: string
  email: string
  user_id: string | null
  source: string
  created_at: string
}

export default function AcademyWaitlistSection() {
  const [items, setItems] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/academy-waitlist?limit=100')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.error && !j.items) {
          setError(j.error)
          setItems([])
          setTotal(0)
        } else {
          setItems(j.items || [])
          setTotal(j.total ?? (j.items?.length || 0))
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('LOAD_FAILED')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function copyEmails() {
    const list = items.map((i) => i.email).join('\n')
    try {
      await navigator.clipboard.writeText(list)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = list
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] px-4 py-3 text-sm text-[#c9b06a]">
        People who tapped <strong className="text-[#e4c979]">Notify me</strong> on Advanced Academy. When the paid path
        launches, email this list. No automated send yet — export and message manually.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#8fa29c]">
          <span className="font-semibold text-white">{total}</span> signup{total === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          disabled={items.length === 0}
          onClick={copyEmails}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.4)] disabled:opacity-40"
        >
          {copied ? (
            <>
              <CheckCircle2 size={14} /> Copied
            </>
          ) : (
            <>
              <Copy size={14} /> Copy all emails
            </>
          )}
        </button>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-[#8fa29c]">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#0b2a26] px-4 py-8 text-center text-sm text-[#8fa29c]">
          No waitlist entries yet.
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b2a26] px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
                <Mail size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{row.email}</p>
                <p className="text-[11px] text-[#7f918c]">
                  {new Date(row.created_at).toLocaleString()} · {row.user_id ? 'Signed-in user' : 'Email only'}
                </p>
              </div>
            </div>
            <a
              href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent('DropVerse Advanced Academy')}`}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-[#c5d0cb] hover:border-[rgba(216,180,90,0.35)] hover:text-[#e4c979]"
            >
              Email
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
