'use client'
import { useEffect, useState } from 'react'
import { RangeTabs, SeriesChart } from '@/components/charts/Series'

type Point = { label: string; value: number }
type Data = { projects?: Point[]; payments?: Point[]; commissions?: Point[] }

function total(points: Point[] = []) {
  return points.reduce((sum, point) => sum + Number(point.value || 0), 0)
}

function Card({ title, value, points }: { title: string; value: string; points: Point[] }) {
  return (
    <article className="card rounded-2xl p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e4c979]">{title}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {points.length ? <SeriesChart points={points} /> : <p className="py-10 text-center text-sm text-[#8ea09a]">No activity in this range.</p>}
    </article>
  )
}

export default function MyCharts() {
  const [range, setRange] = useState('30')
  const [data, setData] = useState<Data>({})

  useEffect(() => {
    let stop = false
    const load = () => {
      fetch(`/api/me/series?range=${range}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (!stop && j) setData(j) })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 15000)
    return () => { stop = true; window.clearInterval(timer) }
  }, [range])

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.16em] text-[#e4c979]">Your performance</h2>
        <RangeTabs value={range} onChange={setRange} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Projects" value={String(total(data.projects))} points={data.projects ?? []} />
        <Card title="Payments" value={`$${total(data.payments).toFixed(0)}`} points={data.payments ?? []} />
        <Card title="Commissions" value={`$${total(data.commissions).toFixed(0)}`} points={data.commissions ?? []} />
      </div>
    </section>
  )
}
