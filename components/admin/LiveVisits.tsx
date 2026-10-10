'use client'
import { useEffect, useState } from 'react'
import { SeriesChart } from '@/components/charts/Series'

type Live = {
  ready?: boolean
  online?: number
  visitors30d?: number | null
  pages?: { path: string; count: number }[]
}
type Point = { label: string; value: number }

export default function LiveVisits() {
  const [data, setData] = useState<Live | null>(null)
  const [points, setPoints] = useState<Point[]>([])

  useEffect(() => {
    let stop = false
    const load = () => {
      fetch('/api/admin/live', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => { if (!stop) setData(j) })
        .catch(() => undefined)
      fetch('/api/admin/series?range=live', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => { if (!stop) setPoints(j.visits ?? []) })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 8000)
    return () => { stop = true; window.clearInterval(timer) }
  }, [])

  const online = data?.online ?? 0
  const maxPage = Math.max(1, ...(data?.pages ?? []).map((p) => p.count))
  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-[rgba(216,180,90,0.28)] bg-[#0c2420]">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7fd8a8] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7fd8a8]" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e4c979]">Live visits</p>
          </div>
          <p className="mt-2 font-display text-4xl font-extrabold text-white">{online}</p>
          <p className="text-sm text-[#9eb0aa]">people on the public site right now</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
          <p className="text-xs text-[#8ea09a]">Public visits, 30 days</p>
          <p className="mt-1 text-xl font-extrabold text-[#f0d98b]">{data?.visitors30d ?? '—'}</p>
        </div>
      </div>
      <div className="border-t border-white/10 px-3 sm:px-5">
        <p className="pt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8ea09a]">Last hour</p>
        {points.length ? <SeriesChart points={points} color="#7fd8a8" /> : <p className="py-10 text-center text-sm text-[#8ea09a]">No public visits in the last hour.</p>}
      </div>
      <div className="space-y-2 border-t border-white/10 p-5">
        {data?.ready === false ? (
          <p className="text-xs leading-5 text-[#c9d5d0]">Live table is not ready yet. Run the site_presence SQL once in Supabase.</p>
        ) : (data?.pages ?? []).length === 0 ? (
          <p className="text-sm text-[#9eb0aa]">No public visitors in the last minute.</p>
        ) : data?.pages?.map((page) => (
          <div key={page.path}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-[#f0f4f2]">{page.path}</span>
              <span className="font-bold text-[#f0d98b]">{page.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d8b45a]" style={{ width: `${Math.max(8, (page.count / maxPage) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
