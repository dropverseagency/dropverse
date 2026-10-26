'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'dv-tools-margin-v1'
type Values = { clientPrice: string; fulfilmentCost: string; fees: string; expenses: string; minimumMargin: string }
const emptyValues: Values = { clientPrice: '', fulfilmentCost: '', fees: '', expenses: '', minimumMargin: '' }

export function grossProfit(price: number, cost: number, fees = 0, expenses = 0) { return price - cost - fees - expenses }
export function marginPercent(profit: number, price: number) { return price === 0 ? null : (profit / price) * 100 }
export function minimumPrice(costs: number, target: number) {
  if (target >= 100) return { value: null, error: 'Enter a minimum margin below 100%.' }
  return { value: costs / (1 - target / 100), error: null }
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(value)
  const previous = useRef(value)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); previous.current = value; return }
    const start = previous.current
    const began = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min((now - began) / 400, 1)
      setShown(start + (value - start) * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else previous.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{shown.toFixed(1)}{suffix}</>
}

function MarginBar({ value }: { value: number }) {
  const [width, setWidth] = useState(value)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setWidth(value); return }
    setWidth(0)
    const frame = requestAnimationFrame(() => setWidth(value))
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <div className="h-full rounded-full bg-[var(--dv-gold)] motion-reduce:transition-none" style={{ width: `${width}%`, transition: 'width 500ms ease-out' }} />
}

function AmountInput({ label, name, value, optional, onChange }: { label: string; name: keyof Values; value: string; optional?: boolean; onChange: (name: keyof Values, value: string) => void }) {
  const invalid = value !== '' && Number(value) < 0
  return <label className="block text-sm font-semibold"><span>{label}{optional ? ' (optional)' : ''}</span><span className="mt-1 block text-xs font-normal text-[var(--dv-muted)]">Amount</span><input name={name} type="number" min="0" step="any" value={value} onChange={(event) => onChange(name, event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--dv-line)] bg-[var(--dv-deep)] px-4 py-3 text-base text-[var(--dv-paper)] outline-none focus:border-[var(--dv-gold)]" />{invalid && <span className="mt-2 block text-sm text-[var(--dv-paper)]">Enter zero or a positive number.</span>}</label>
}

export default function MarginCalculator() {
  const [values, setValues] = useState<Values>(emptyValues)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setValues({ ...emptyValues, ...JSON.parse(saved) }) } catch {} setLoaded(true) }, [])
  useEffect(() => { if (!loaded) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)) } catch {} }, [values, loaded])
  const setValue = (name: keyof Values, value: string) => setValues((current) => ({ ...current, [name]: value }))
  const required = values.clientPrice !== '' && values.fulfilmentCost !== ''
  const invalid = Object.values(values).some((value) => value !== '' && Number(value) < 0)
  const price = Number(values.clientPrice), cost = Number(values.fulfilmentCost), fees = Number(values.fees || 0), expenses = Number(values.expenses || 0)
  const profit = grossProfit(price, cost, fees, expenses)
  const margin = marginPercent(profit, price)
  const hasTarget = values.minimumMargin !== '', target = Number(values.minimumMargin)
  const requiredPrice = hasTarget ? minimumPrice(cost + fees + expenses, target) : null
  const showResults = required && !invalid
  const status = hasTarget && margin !== null && target < 100 ? (margin >= target ? 'Above your minimum margin' : 'Below your minimum margin') : ''
  const bar = margin === null ? 0 : Math.max(0, Math.min(100, margin))

  return <main className="min-h-screen bg-[var(--dv-deep)] text-[var(--dv-paper)]"><div className="container max-w-5xl pb-20 pt-12 sm:pt-20"><Link href="/tools" className="text-sm text-[var(--dv-muted)] underline underline-offset-4">Back to tools</Link><header className="mt-10 max-w-3xl text-start"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dv-muted)]">FREE TOOL</p><h1 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">Margin calculator</h1><p className="mt-5 text-base leading-7 text-[var(--dv-muted)]">Use your own amounts to check a job before you quote it.</p></header><div className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.9fr]"><section className="rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-5 sm:p-8" aria-label="Margin inputs"><div className="grid gap-6 sm:grid-cols-2"><AmountInput label="Client price" name="clientPrice" value={values.clientPrice} onChange={setValue}/><AmountInput label="Fulfilment cost" name="fulfilmentCost" value={values.fulfilmentCost} onChange={setValue}/><AmountInput label="Platform or payment fees" name="fees" value={values.fees} optional onChange={setValue}/><AmountInput label="Other expenses" name="expenses" value={values.expenses} optional onChange={setValue}/><AmountInput label="Minimum acceptable margin %" name="minimumMargin" value={values.minimumMargin} optional onChange={setValue}/></div></section><section aria-live="polite" className="rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface-2)] p-5 sm:p-8"><h2 className="font-display text-2xl font-bold">Results</h2>{showResults ? <div className="mt-7 space-y-6"><div><p className="text-sm text-[var(--dv-muted)]">Gross profit</p><p className="mt-1 text-3xl font-bold"><AnimatedNumber value={profit}/></p></div><div><p className="text-sm text-[var(--dv-muted)]">Margin</p><p className="mt-1 text-3xl font-bold"><AnimatedNumber value={margin ?? 0} suffix="%"/></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--dv-line)]"><MarginBar value={bar} /></div></div>{requiredPrice && (requiredPrice.error ? <p className="text-sm text-[var(--dv-paper)]">{requiredPrice.error}</p> : <div><p className="text-sm text-[var(--dv-muted)]">Minimum price for your target</p><p className="mt-1 text-2xl font-bold"><AnimatedNumber value={requiredPrice.value ?? 0}/></p></div>)}{status && <p key={status} className="status-enter text-sm font-semibold">{status}</p>}</div> : <p className="mt-5 text-sm leading-6 text-[var(--dv-muted)]">Enter a client price and fulfilment cost to see the results.</p>}</section></div><p className="mt-8 text-sm leading-6 text-[var(--dv-muted)]">This calculator does not know your market. Check your numbers before you quote.</p></div><style jsx global>{`@keyframes dv-status-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.status-enter{animation:dv-status-in 200ms ease-out}@media(prefers-reduced-motion:reduce){.status-enter{animation:none}}`}</style></main>
}
