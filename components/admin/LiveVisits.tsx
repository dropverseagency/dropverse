'use client'
import { useEffect, useState } from 'react'

type Live = {
  ready?: boolean
  online?: number
  visitors30d?: number | null
  pages?: { path: string; count: number }[]
  visitors?: { path: string; lastSeen: string }[]
}

export default function LiveVisits() {
  const [data, setData] = useState<Live | null>(null)

  useEffect(() => {
    let stop = false
    const load = () => {
      fetch('/api/admin/live', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => { if (!stop) setData(j) })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 10000)
    return () => { stop = true; window.clearInterval(timer) }
  }, [])

  const online = data?.online ?? 0
  return (
    <section className="mb-8 rounded-2xl border border-[rgba(216,180,90,0.28)] bg-[#0c2420] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e4c979]">Live visits</p>
          <p className="mt-1 text-3xl font-extrabold text-white">{online}</p>
          <p className="text-xs text-[#9eb0aa]">on the public site right now</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(92,200,150,0.35)] bg-[rgba(92,200,150,0.12)] px-3 py-1 text-xs font-semibold text-[#7fd8a8]">
          <span className="h-2 w-2 rounded-full bg-[#7fd8a8]" />
          Live
        </span>
      </div>
      {data?.ready === false ? (
        <p className="mt-4 text-xs leading-5 text-[#c9d5d0]">Live table is not ready yet. Run the site_presence SQL once in Supabase.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {(data?.pages ?? []).length === 0 ? (
            <p className="text-sm text-[#9eb0aa]">No public visitors in the last minute.</p>
          ) : data?.pages?.map((page) => (
            <div key={page.path} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-[#f0f4f2]">{page.path}</span>
              <span className="font-bold text-[#f0d98b]">{page.count}</span>
            </div>
          ))}
          <p className="pt-1 text-xs text-[#8ea09a]">Public visits, 30 days: {data?.visitors30d ?? '—'}</p>
        </div>
      )}
    </section>
  )
}
