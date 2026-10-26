'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'dv-tools-delivery-v1'
const statuses = ['Paid', 'In progress', 'Delivered', 'Needs revision'] as const
type Status = typeof statuses[number]
type Job = { id: string; title: string; client: string; status: Status; dueDate: string; amount: string; changed: number }
type Draft = Omit<Job, 'id' | 'changed'>
const emptyDraft: Draft = { title: '', client: '', status: 'Paid', dueDate: '', amount: '' }

function localDate(date: string) { return new Date(`${date}T00:00:00`) }
function daysFromToday(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((localDate(date).getTime() - today.getTime()) / 86400000)
}

export default function DeliveryTracker() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'All' | Status>('All')
  const [deleteReady, setDeleteReady] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setJobs(JSON.parse(saved)) } catch {} setLoaded(true) }, [])
  useEffect(() => { if (!loaded) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)) } catch {} }, [jobs, loaded])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) { setError('Add a job title.'); return }
    if (draft.title.length > 80 || draft.client.length > 60) { setError('Keep the title under 80 characters and the client name under 60.'); return }
    if (draft.amount !== '' && Number(draft.amount) < 0) { setError('Amount must be zero or more.'); return }
    const changed = Date.now()
    if (editing) setJobs((items) => items.map((job) => job.id === editing ? { ...draft, title: draft.title.trim(), client: draft.client.trim(), id: job.id, changed } : job))
    else setJobs((items) => [{ ...draft, title: draft.title.trim(), client: draft.client.trim(), id: crypto.randomUUID(), changed }, ...items])
    setDraft(emptyDraft); setEditing(null); setError('')
  }
  const edit = (job: Job) => { setDraft({ title: job.title, client: job.client, status: job.status, dueDate: job.dueDate, amount: job.amount }); setEditing(job.id); setError(''); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
  const requestDelete = (id: string) => {
    if (deleteReady !== id) { setDeleteReady(id); return }
    setDeleting(id); setDeleteReady(null)
    window.setTimeout(() => { setJobs((items) => items.filter((job) => job.id !== id)); setDeleting(null) }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200)
  }
  const changeStatus = (id: string, status: Status) => setJobs((items) => items.map((job) => job.id === id ? { ...job, status } : job))
  const dueSoon = useMemo(() => jobs.filter((job) => job.dueDate && job.status !== 'Delivered' && daysFromToday(job.dueDate) <= 3).sort((a, b) => localDate(a.dueDate).getTime() - localDate(b.dueDate).getTime()), [jobs])
  const visible = filter === 'All' ? jobs : jobs.filter((job) => job.status === filter)
  const activeAmount = jobs.filter((job) => job.status === 'Paid' || job.status === 'In progress').reduce((sum, job) => sum + Number(job.amount || 0), 0)

  return <main className="min-h-screen bg-[var(--dv-deep)] text-[var(--dv-paper)]"><div className="container max-w-6xl pb-20 pt-12 sm:pt-20"><Link href="/tools" className="text-sm text-[var(--dv-muted)] underline underline-offset-4">Back to tools</Link><header className="mt-10 max-w-3xl text-start"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dv-muted)]">FREE TOOL</p><h1 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">Delivery tracker</h1><p className="mt-5 text-base leading-7 text-[var(--dv-muted)]">Saved on this device only. Clearing your browser data will remove these jobs.</p></header>

    {dueSoon.length > 0 && <section className="mt-10 rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface-2)] p-5 sm:p-7" aria-labelledby="due-title"><h2 id="due-title" className="font-display text-2xl font-bold">Due within 3 days</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{dueSoon.map((job) => { const days = daysFromToday(job.dueDate); return <div key={job.id} className="rounded-xl border border-[var(--dv-line)] bg-[var(--dv-deep)] p-4"><p className="font-semibold">{job.title}</p><p className="mt-1 text-sm text-[var(--dv-muted)]">{days < 0 ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}` : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`}</p></div> })}</div></section>}

    <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"><form onSubmit={submit} className="rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-5 sm:p-7"><h2 className="font-display text-2xl font-bold">{editing ? 'Edit job' : 'Add job'}</h2><div className="mt-6 space-y-5"><Field label="Job title" required><input maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--dv-line)] bg-[var(--dv-deep)] px-4 py-3 text-base text-[var(--dv-paper)] outline-none focus:border-[var(--dv-gold)]" /></Field><Field label="Client name (optional)"><input maxLength={60} value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--dv-line)] bg-[var(--dv-deep)] px-4 py-3 text-base text-[var(--dv-paper)] outline-none focus:border-[var(--dv-gold)]" /></Field><Field label="Status"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })} className="mt-2 w-full rounded-xl border border-[var(--dv-line)] bg-[var(--dv-deep)] px-4 py-3 text-base text-[var(--dv-paper)] outline-none focus:border-[var(--dv-gold)]">{statuses.map((status) => <option key={status}>{status}</option>)}</select></Field><Field label="Due date (optional)"><input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--dv-line)] bg-[var(--dv-deep)] px-4 py-3 text-base text-[var(--dv-paper)] outline-none focus:border-[var(--dv-gold)]" /></Field><Field label="Amount (optional)"><input type="number" min="0" step="any" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--dv-line)] bg-[var(--dv-deep)] px-4 py-3 text-base text-[var(--dv-paper)] outline-none focus:border-[var(--dv-gold)]" /></Field></div>{error && <p className="mt-4 text-sm font-semibold">{error}</p>}<div className="mt-6 flex flex-wrap gap-3"><button type="submit" className="rounded-full bg-[var(--dv-gold)] px-5 py-3 text-sm font-bold text-[var(--dv-deep)]">{editing ? 'Save job' : 'Add job'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setDraft(emptyDraft) }} className="rounded-full border border-[var(--dv-line)] px-5 py-3 text-sm font-semibold">Cancel</button>}</div></form>

      <section><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{statuses.map((status) => <Summary key={status} label={status} value={String(jobs.filter((job) => job.status === status).length)} />)}<Summary label="Active amount" value={activeAmount.toFixed(1)} /></div><div className="mt-7 flex flex-wrap gap-2" aria-label="Filter jobs">{(['All', ...statuses] as const).map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-full border px-4 py-2 text-sm transition-colors ${filter === status ? 'border-[var(--dv-gold)] bg-[var(--dv-surface-2)]' : 'border-[var(--dv-line)] text-[var(--dv-muted)]'}`}>{status}</button>)}</div><div className="mt-5 space-y-4">{visible.length === 0 ? <p className="rounded-2xl border border-[var(--dv-line)] p-6 text-sm text-[var(--dv-muted)]">No jobs in this view.</p> : visible.map((job) => <article key={`${job.id}-${job.changed}`} className={`job-enter overflow-hidden rounded-2xl border border-[var(--dv-line)] bg-[var(--dv-surface)] transition-[max-height,opacity,margin,padding] duration-200 motion-reduce:transition-none ${deleting === job.id ? 'max-h-0 border-0 p-0 opacity-0' : 'max-h-96 p-5 opacity-100'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl font-bold">{job.title}</h3>{job.client && <p className="mt-1 text-sm text-[var(--dv-muted)]">{job.client}</p>}</div><select aria-label={`Status for ${job.title}`} value={job.status} onChange={(e) => changeStatus(job.id, e.target.value as Status)} className="rounded-full border border-[var(--dv-line)] bg-[var(--dv-surface-2)] px-3 py-1.5 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none">{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--dv-muted)]">{job.dueDate && <span>Due {job.dueDate}</span>}{job.amount !== '' && <span>Amount {Number(job.amount).toFixed(1)}</span>}</div><div className="mt-5 flex gap-4"><button type="button" onClick={() => edit(job)} className="text-sm font-semibold underline underline-offset-4">Edit</button><button type="button" onClick={() => requestDelete(job.id)} className="text-sm font-semibold underline underline-offset-4">{deleteReady === job.id ? 'Click again to delete' : 'Delete'}</button></div></article>)}</div></section></div></div><style jsx global>{`@keyframes dv-job-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.job-enter{animation:dv-job-in 200ms ease-out}@media(prefers-reduced-motion:reduce){.job-enter{animation:none}}`}</style></main>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="block text-sm font-semibold"><span>{label}{required && <span aria-hidden="true"> *</span>}</span>{children}</label> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--dv-line)] bg-[var(--dv-surface-2)] p-3"><p className="text-xs text-[var(--dv-muted)]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div> }
