'use client'
import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '$0.00'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function truncateId(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 8) + '…'
}

export const STATUS_STYLES: Record<string, string> = {
  PAYMENT_CONFIRMED: 'bg-[rgba(92,200,150,0.16)] text-[#7fd8a8] border-[rgba(92,200,150,0.35)]',
  PAYMENT_PENDING: 'bg-[rgba(230,190,90,0.14)] text-[#f0d98b] border-[rgba(230,190,90,0.35)]',
  PAYMENT_FAILED: 'bg-[rgba(230,90,90,0.14)] text-[#f5a0a0] border-[rgba(230,90,90,0.35)]',
  PAYMENT_DISPUTED: 'bg-[rgba(230,120,60,0.14)] text-[#f5c48a] border-[rgba(230,120,60,0.35)]',
  approved: 'bg-[rgba(92,200,150,0.16)] text-[#7fd8a8] border-[rgba(92,200,150,0.35)]',
  available: 'bg-[rgba(120,170,255,0.16)] text-[#9db8ff] border-[rgba(120,170,255,0.35)]',
  paid: 'bg-[rgba(92,200,150,0.16)] text-[#7fd8a8] border-[rgba(92,200,150,0.35)]',
  pending: 'bg-[rgba(230,190,90,0.14)] text-[#f0d98b] border-[rgba(230,190,90,0.35)]',
  reversed: 'bg-[rgba(230,90,90,0.14)] text-[#f5a0a0] border-[rgba(230,90,90,0.35)]',
  cancelled: 'bg-[rgba(150,160,170,0.14)] text-[#b8c0c8] border-[rgba(150,160,170,0.35)]',
  active: 'bg-[rgba(92,200,150,0.16)] text-[#7fd8a8] border-[rgba(92,200,150,0.35)]',
  rejected: 'bg-[rgba(230,90,90,0.14)] text-[#f5a0a0] border-[rgba(230,90,90,0.35)]',
  admin: 'bg-[rgba(216,180,90,0.18)] text-[#f0d98b] border-[rgba(216,180,90,0.45)]',
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-white/5 text-[#9aac b8] border-white/10'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {label ?? status}
    </span>
  )
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-4">
      <div className="text-xs uppercase tracking-wider text-[#7f918c]">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-[#f0f4f2]">{value}</div>
      {sub ? <div className="mt-1 text-xs text-[#7f918c]">{sub}</div> : null}
    </div>
  )
}

export function Card({ title, className = '', children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] ${className}`}>
      {title ? <h2 className="border-b border-white/5 px-4 py-3 text-sm font-bold tracking-wide text-[#e8edea]">{title}</h2> : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Generic pagination + search controls */
export function TableControls(props: {
  q: string
  onQ: (v: string) => void
  page: number
  count: number
  limit: number
  onPrev: () => void
  onNext: () => void
  placeholder?: string
}) {
  const maxPage = Math.max(1, Math.ceil((props.count || 0) / props.limit))
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative max-w-xs flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f918c]" />
        <input
          value={props.q}
          onChange={(e) => props.onQ(e.target.value)}
          placeholder={props.placeholder ?? 'Search...'}
          className="w-full rounded-lg border border-white/10 bg-[rgba(255,255,255,0.03)] py-2 pl-9 pr-3 text-sm text-[#d9e0dc] outline-none transition focus:border-[rgba(216,180,90,0.5)]"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-[#7f918c]">
        <button onClick={props.onPrev} disabled={props.page <= 1} className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:bg-white/5 disabled:opacity-40">
          ← Prev
        </button>
        <span>Page {props.page} / {maxPage}</span>
        <button onClick={props.onNext} disabled={props.page >= maxPage} className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:bg-white/5 disabled:opacity-40">
          Next →
        </button>
      </div>
    </div>
  )
}

export function useAdminData<T = any>(section: string, deps: (string | number)[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const url = new URL('/api/admin/data', window.location.origin)
    url.searchParams.set('section', section)
    deps.forEach((d, i) => {
      const keys = ['page', 'limit', 'q', 'payment_status', 'status', 'entity']
      url.searchParams.set(keys[i % keys.length], String(d))
    })
    fetch(url.href).then((r) => r.json()).then((j) => {
      if (cancelled) return
      if (j.error) {
        setError(j.error)
        setData(null)
      } else {
        setData(j)
        setError(null)
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled) { setError('NETWORK_ERROR'); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [section, ...deps])

  return { data, loading, error }
}

export function LoadingOrError({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#7f918c]">
        <Loader2 className="animate-spin" size={22} /> <span className="ml-2 text-sm">Loading...</span>
      </div>
    )
  }
  if (error) {
    return <div className="rounded-lg border border-[rgba(230,90,90,0.3)] bg-[rgba(230,90,90,0.08)] px-4 py-3 text-sm text-[#f5a0a0]">{error}</div>
  }
  return null
}

export async function adminMutate(action: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return (await res.json()) as Record<string, unknown>
}

export function emptyNote(msg: string) {
  return <div className="py-10 text-center text-sm text-[#7f918c]">{msg}</div>
}
