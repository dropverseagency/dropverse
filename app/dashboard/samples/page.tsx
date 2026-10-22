'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

type Sample = {
  id: string
  title: string
  category: string
  status: string
  rejection_reason: string | null
  created_at: string
  sample_files?: { id: string; kind: string; size_bytes: number }[]
}

const categories = ['Video Editing', 'Graphic Design', 'Web Design', 'Social Media Content', 'UGC Content', 'Copywriting', 'Branding', 'Motion Graphics']
const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Needs changes',
  unpublished: 'Unpublished',
}

export default function FreelancerSamplesPage() {
  const [items, setItems] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [turnaround, setTurnaround] = useState('3')
  const [rights, setRights] = useState(false)
  const [files, setFiles] = useState<FileList | null>(null)
  const [cover, setCover] = useState<File | null>(null)

  async function load() {
    setLoading(true)
    const response = await fetch('/api/samples?mine=1')
    const json = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      if (response.status === 403) setAccessDenied(true)
      setError(json.error === 'FREELANCER_ONLY' ? 'Only accounts registered as a freelancer can submit work samples.' : json.error || 'Could not load your samples.')
      return
    }
    setError('')
    setItems(json.items || [])
  }

  useEffect(() => { load() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!files || files.length < 1) {
      setError('Upload at least one sample file.')
      return
    }
    const totalBytes = Array.from(files).reduce((sum, file) => sum + file.size, 0) + (cover?.size || 0)
    if (totalBytes > 100 * 1024 * 1024) {
      setError('Keep the combined upload under 100 MB.')
      return
    }
    const form = new FormData()
    form.set('title', title)
    form.set('category', category)
    form.set('description', description)
    form.set('price_usd', price)
    form.set('cost_usd', cost)
    form.set('turnaround_days', turnaround)
    form.set('rights_confirmed', String(rights))
    Array.from(files).forEach((file) => form.append('files', file))
    if (cover) form.set('cover', cover)

    setBusy(true)
    const response = await fetch('/api/samples', { method: 'POST', body: form })
    const json = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setError(json.error === 'FREELANCER_ONLY' ? 'Your account is not registered as a freelancer. Switch your account type in profile settings first.' : json.error || 'Submission failed. Please try again.')
      return
    }
    setSuccess('Submitted successfully. Your sample is hidden until an admin reviews it.')
    setTitle('')
    setDescription('')
    setPrice('')
    setCost('')
    setTurnaround('3')
    setRights(false)
    setFiles(null)
    setCover(null)
    const fileInput = document.getElementById('sample-files') as HTMLInputElement | null
    if (fileInput) fileInput.value = ''
    const coverInput = document.getElementById('sample-cover') as HTMLInputElement | null
    if (coverInput) coverInput.value = ''
    await load()
  }

  if (accessDenied) return <main className="min-h-screen bg-[#071b19] px-4 py-16 text-[#f4f7f5]"><div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#0b2824] p-8 text-center"><h1 className="text-2xl font-black">Freelancer account required</h1><p className="mt-3 text-sm leading-6 text-[#a9bbb5]">Only accounts registered as a freelancer can submit work samples. Sign in with the correct account or update your account type in profile settings.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-[#d8b45a] px-5 py-3 font-bold text-[#10221f]">Back to dashboard</Link></div></main>

  return (
    <main className="min-h-screen bg-[#071b19] px-4 py-8 text-[#f4f7f5] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm text-[#a9bbb5] hover:text-white">← Dashboard</Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-[#d8b45a]">Freelancer workspace</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Your work samples</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a9bbb5]">Submit real work you have the rights to share. Your listing stays private until DropVerse reviews and approves it.</p>
          </div>
          <Link href="/samples" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:border-white/30">View public vault ↗</Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-[#0b2824] p-5 sm:p-7">
            <h2 className="text-xl font-bold">Submit a sample for review</h2>
            <label className="block text-sm text-[#c7d3ce]">Sample title
              <input required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white outline-none focus:border-[#d8b45a]" placeholder="e.g. Short-form product video edit" />
            </label>
            <label className="block text-sm text-[#c7d3ce]">Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white">
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm text-[#c7d3ce]">Description
              <textarea maxLength={1000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white" placeholder="Describe the work, tools, and deliverable." />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm text-[#c7d3ce]">Client price (USD, optional)
                <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white" placeholder="Optional" />
              </label>
              <label className="block text-sm text-[#c7d3ce]">Your delivery cost (USD)
                <input required type="number" min="1" max="5000" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white" placeholder="e.g. 25" />
              </label>
              <label className="block text-sm text-[#c7d3ce]">Turnaround (days)
                <input required type="number" min="1" max="30" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-3 text-white" />
              </label>
            </div>
            <label className="block text-sm text-[#c7d3ce]">Work files (1–10, up to 100 MB combined)
              <input id="sample-files" required multiple type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime" onChange={(e) => setFiles(e.target.files)} className="mt-2 block w-full rounded-xl border border-white/10 bg-[#071b19] p-3 text-xs text-[#a9bbb5] file:mr-3 file:rounded-full file:border-0 file:bg-[#d8b45a] file:px-3 file:py-2 file:font-bold file:text-[#10221f]" />
            </label>
            <label className="block text-sm text-[#c7d3ce]">Cover image (optional)
              <input id="sample-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCover(e.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border border-white/10 bg-[#071b19] p-3 text-xs text-[#a9bbb5] file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:font-semibold file:text-white" />
            </label>
            <label className="flex items-start gap-3 text-xs leading-5 text-[#a9bbb5]">
              <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 accent-[#d8b45a]" />
              <span>I confirm that I own this work or have permission to share it, and that it contains no confidential client information or material I am not authorized to publish. If DropVerse approves it, I grant DropVerse a non-exclusive, worldwide, royalty-free license to display and promote this sample in the public Samples Vault and let DropVerse users (including Drop Servicers) show it in proposals, portfolios, and marketing to help sell the relevant digital services. I understand this does not transfer ownership or let anyone claim they created my work. I can request that DropVerse remove the public listing for future use by contacting support; this does not undo uses already made lawfully.</span>
            </label>
            {error ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}
            {success ? <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{success}</p> : null}
            <button disabled={busy} className="w-full rounded-full bg-[#d8b45a] px-5 py-3 font-bold text-[#10221f] disabled:cursor-wait disabled:opacity-60">{busy ? 'Uploading and submitting…' : 'Submit for review'}</button>
          </form>

          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-[#0b2824] p-5 sm:p-7">
              <h2 className="text-xl font-bold">Review process</h2>
              <ol className="mt-4 space-y-4 text-sm leading-6 text-[#a9bbb5]">
                <li><strong className="text-white">1. Submit:</strong> upload the real work and confirm your sharing rights.</li>
                <li><strong className="text-white">2. Review:</strong> DropVerse checks quality, ownership, pricing, and completeness.</li>
                <li><strong className="text-white">3. Publish:</strong> only approved samples appear in the public vault.</li>
              </ol>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0b2824] p-5 sm:p-7">
              <h2 className="text-xl font-bold">Your submissions</h2>
              {loading ? <p className="mt-4 text-sm text-[#a9bbb5]">Loading…</p> : null}
              {!loading && items.length === 0 ? <p className="mt-4 text-sm text-[#a9bbb5]">You have not submitted any samples yet.</p> : null}
              <ul className="mt-4 space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-white/10 bg-[#071b19] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-[#7f9890]">{item.category}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === 'approved' ? 'bg-emerald-400/10 text-emerald-200' : item.status === 'rejected' ? 'bg-red-400/10 text-red-200' : 'bg-[#d8b45a]/10 text-[#e8cc7d]'}`}>{statusLabels[item.status] || item.status}</span>
                    </div>
                    {item.rejection_reason ? <p className="mt-3 text-xs leading-5 text-red-200">Review note: {item.rejection_reason}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
