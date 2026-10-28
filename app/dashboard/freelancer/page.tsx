'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react'

type FreelancerData = {
  profile: { display_name: string; category: string; niches?: string[]; bio?: string } | null
  availability: { available: boolean; capacity: number; typical_turnaround_days: number | null }
  verification: { identity_status: string; specialty_status: string; verified_level: string; specialty_review_note?: string | null }
}

export default function FreelancerOperationsPage() {
  const [data, setData] = useState<FreelancerData | null>(null)
  const [available, setAvailable] = useState(false)
  const [capacity, setCapacity] = useState(1)
  const [turnaround, setTurnaround] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/freelancers/profile', { credentials: 'include' })
      const json = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.assign('/login?redirect=%2Fdashboard%2Ffreelancer')
        return
      }
      if (!response.ok) {
        setError(response.status === 403 ? 'This page is for registered freelancers. Complete freelancer registration first.' : 'Could not load freelancer settings.')
        return
      }
      const result = json as FreelancerData
      setData(result)
      setAvailable(Boolean(result.availability?.available))
      setCapacity(Math.max(0, Number(result.availability?.capacity ?? 1)))
      setTurnaround(Math.max(1, Number(result.availability?.typical_turnaround_days ?? 3)))
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function save() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/freelancers/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available, capacity, typicalTurnaroundDays: turnaround }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        const messages: Record<string, string> = {
          AVAILABLE_REQUIRES_CAPACITY: 'Set capacity to at least 1 before marking yourself available.',
          INVALID_AVAILABILITY: 'Choose a valid availability and capacity.',
          INVALID_TURNAROUND: 'Turnaround must be between 1 and 90 days.',
        }
        setError(messages[json.error] || 'Could not save your availability.')
        return
      }
      setSuccess('Availability settings saved.')
      await load()
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const verification = data?.verification
  const verified = verification?.identity_status === 'verified' && verification?.specialty_status === 'passed' && ['specialist', 'pro'].includes(verification?.verified_level || '')

  return (
    <main className="min-h-screen bg-[#071f1d] px-4 py-8 text-[#e7edea] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#9aaca6] hover:text-white"><ArrowLeft size={16}/> Back to workspace</Link>
        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Freelancer operations</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-white">Availability & verification</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9aaca6]">Keep your capacity and delivery estimate accurate. Only freelancers with approved identity and specialty reviews can receive project assignments.</p>
        </div>

        {loading ? <div className="mt-6 rounded-2xl border border-white/10 bg-[#0a2926] p-6 text-sm text-[#9aaca6]">Loading freelancer settings…</div> : null}
        {error ? <p className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}

        {!loading && data?.profile ? (
          <>
            <section className="mt-6 rounded-2xl border border-white/10 bg-[#0a2926] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8b45a]/30 bg-[#d8b45a]/10 text-[#e4c979]"><ShieldCheck size={21}/></div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold text-white">{data.profile.display_name}</h2>
                  <p className="mt-1 text-sm text-[#9aaca6]">{data.profile.category}{data.profile.niches?.length ? ` · ${data.profile.niches.length} selected niches` : ''}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Status label={`Identity: ${verification?.identity_status || 'unsubmitted'}`} good={verification?.identity_status === 'verified'} />
                    <Status label={`Specialty: ${verification?.specialty_status || 'unreviewed'}`} good={verification?.specialty_status === 'passed'} />
                    <Status label={`Level: ${verification?.verified_level || 'none'}`} good={verified} />
                  </div>
                  {!verified ? <p className="mt-3 text-xs leading-5 text-[#b5c2bd]">Your profile can be completed before verification, but project assignments stay locked until an admin reviews and approves your identity and specialty.</p> : <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 size={14}/> Your verification is approved for project assignment.</p>}
                  {verification?.specialty_review_note ? <p className="mt-2 text-xs text-[#9aaca6]">Review note: {verification.specialty_review_note}</p> : null}
                  <Link href="/dashboard/samples" className="mt-3 inline-flex text-sm font-semibold text-[#e4c979] hover:text-white">Manage work samples →</Link>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-white/10 bg-[#0a2926] p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-white">Your capacity</h2>
              <p className="mt-1 text-sm text-[#9aaca6]">Set whether you can take new projects and how many active projects you can handle at once.</p>
              <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/10 p-4">
                <span><span className="block text-sm font-semibold text-white">Available for new projects</span><span className="mt-1 block text-xs text-[#9aaca6]">Turn this off whenever your schedule is full.</span></span>
                <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} className="h-5 w-5 accent-[#d8b45a]"/>
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-[#c8d4d0]">Maximum active projects
                  <input type="number" min={available ? 1 : 0} max={50} step={1} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white"/>
                </label>
                <label className="block text-sm text-[#c8d4d0]">Typical turnaround (days)
                  <input type="number" min={1} max={90} step={1} value={turnaround} onChange={e => setTurnaround(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white"/>
                </label>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-[#9aaca6]"><Clock3 size={14}/> These settings help prevent assignments beyond your stated capacity.</p>
              {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}
              <button disabled={saving || loading} onClick={() => void save()} className="mt-5 rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-50">{saving ? 'Saving…' : 'Save availability'}</button>
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}

function Status({ label, good }: { label: string; good: boolean }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${good ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-[#aab9b4]'}`}>{label}</span>
}
