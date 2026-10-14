'use client'
import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '$0.00'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function truncateId(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 8) + '…'
}

export const STATUS_STYLES: Record<string, string> = {
  PAYMENT_CONFIRMED: 'bg-success/15 text-success border-success/35',
  PAYMENT_PENDING: 'bg-primary/15 text-primary border-primary/35',
  PAYMENT_FAILED: 'bg-danger/15 text-danger border-danger/35',
  PAYMENT_DISPUTED: 'bg-warning/15 text-warning border-warning/35',
  approved: 'bg-success/15 text-success border-success/35',
  available: 'bg-primary/15 text-primary border-primary/35',
  paid: 'bg-success/15 text-success border-success/35',
  pending: 'bg-primary/15 text-primary border-primary/35',
  reversed: 'bg-danger/15 text-danger border-danger/35',
  cancelled: 'bg-muted text-muted-foreground border-border',
  active: 'bg-success/15 text-success border-success/35',
  rejected: 'bg-danger/15 text-danger border-danger/35',
  admin: 'bg-primary/15 text-primary border-primary/45',
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {label ?? status}
    </span>
  )
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-foreground">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

export function Card({
  title,
  className = '',
  children,
}: {
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card shadow-soft ${className}`}>
      {title ? (
        <h2 className="border-b border-border px-4 py-3.5 text-sm font-bold tracking-wide text-foreground sm:px-5">
          {title}
        </h2>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

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
      <div className="relative w-full flex-1 sm:max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={props.q}
          onChange={(e) => props.onQ(e.target.value)}
          placeholder={props.placeholder ?? 'Search...'}
          className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary/50"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          onClick={props.onPrev}
          disabled={props.page <= 1}
          className="rounded-lg border border-border px-3 py-1.5 transition hover:bg-muted disabled:opacity-40"
        >
          ← Prev
        </button>
        <span>
          Page {props.page} / {maxPage}
        </span>
        <button
          onClick={props.onNext}
          disabled={props.page >= maxPage}
          className="rounded-lg border border-border px-3 py-1.5 transition hover:bg-muted disabled:opacity-40"
        >
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
    url.searchParams.set('ts', String(Date.now()))
    deps.forEach((d, i) => {
      const keys = ['page', 'limit', 'q', 'payment_status', 'status', 'entity']
      url.searchParams.set(keys[i % keys.length], String(d))
    })
    fetch(url.href)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.error) {
          setError(j.error)
          setData(null)
        } else {
          setData(j)
          setError(null)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('NETWORK_ERROR')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [section, ...deps])

  useEffect(() => {
    const refetch = () => {
      const url = new URL('/api/admin/data', window.location.origin)
      url.searchParams.set('section', section)
      url.searchParams.set('ts', String(Date.now()))
      deps.forEach((d, i) => {
        const keys = ['page', 'limit', 'q', 'payment_status', 'status', 'entity']
        url.searchParams.set(keys[i % keys.length], String(d))
      })
      fetch(url.href)
        .then((r) => r.json())
        .then((j) => {
          if (!j.error) {
            setData(j)
            setError(null)
          }
        })
        .catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(refetch, 20000)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [section, ...deps])

  return { data, loading, error }
}

export function LoadingOrError({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="animate-spin" size={22} /> <span className="ml-2 text-sm">Loading...</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
    )
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
  return <div className="py-10 text-center text-sm text-muted-foreground">{msg}</div>
}
