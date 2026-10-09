'use client'
import { useEffect, useState } from 'react'
import { RangeTabs, SeriesChart } from '@/components/charts/Series'

type Point = { label: string; value: number }
type Data = { visits?: Point[]; users?: Point[]; projects?: Point[]; payments?: Point[] }

function total(points: Point[] = []) {
  return points.reduce((sum, point) => sum + Number(point.value || 0), 0)
}

function ChartCard({ title, value, points, money }: { title: string; value: string; points: Point[]; money?: boolean }) {
  return (
    <article className="rounded-2xl border border-[rgba(216,180,90,0.18)] bg-[#0c2420] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e4c979]">{title}</p>
          <p className="mt-1 text-2xl font-extrabold text-white">{value}</p>
        </div>
      </div>
      {points.length ? <SeriesChart points={points} /> : <p className="py-12 text-center text-sm text-[#8ea09a]">No data in this range.</p>}
      <p className="text-xs text-[#8ea09a]">{points.length} points · updates automatically</p>
    </article>
  )
}

export default function AnalyticsBoard() {
  const [range, setRange] = useState('30')
  const [data, setData] = useState<Data>({})

  useEffect(() => {
    let stop = false
    const load = () => {
      fetch(`/api/admin/series?range=${range}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => { if (!stop) setData(j) })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 15000)
    return () => { stop = true; window.clearInterval(timer) }
  }, [range])

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xs font-extrabold uppercase tracking-[0.18em] text-[#e4c979]">Trends</h2>
        <RangeTabs value={range} onChange={setRange} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Public visits" value={String(total(data.visits))} points={data.visits ?? []} />
        <ChartCard title="New users" value={String(total(data.users))} points={data.users ?? []} />
        <ChartCard title="Projects" value={String(total(data.projects))} points={data.projects ?? []} />
        <ChartCard title="Confirmed payments" value={`$${total(data.payments).toFixed(0)}`} points={data.payments ?? []} money />
      </div>
    </section>
  )
}
