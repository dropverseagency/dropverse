'use client'
import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, MessageSquare, RefreshCw, ShieldAlert, UserRound } from 'lucide-react'
import { useAuth } from '../../../../lib/useAuth'

type Row = Record<string, unknown> & { id: string; created_at?: string }
type Data = { project: Row; actor: 'seller' | 'freelancer' | 'admin'; assignments: Row[]; messages: Row[]; deliveries: Row[]; revisions: Row[]; disputes: Row[]; events: Row[] }
type Freelancer = { user_id:string; display_name:string; category:string; availability:{typical_turnaround_days?:number} }

export default function ProjectOperationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const auth = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState('')
  const [freelancerId, setFreelancerId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null)
  const [portalUrl, setPortalUrl] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${id}/operations`, { credentials: 'include' })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) { setError(json.error || 'Could not load project.'); return }
    setData(json); setError('')
  }, [id])

  useEffect(() => { if (!auth.loading && !auth.user) window.location.assign(`/login?redirect=${encodeURIComponent(`/dashboard/projects/${id}`)}`) }, [auth.loading, auth.user, id])
  useEffect(() => { if (auth.user) void load() }, [auth.user, load])
  useEffect(() => { if (auth.user) fetch('/api/freelancers/available').then(r=>r.json()).then(j=>setFreelancers(j.freelancers||[])).catch(()=>undefined) }, [auth.user])

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setError('')
    const response = await fetch(`/api/projects/${id}/operations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
    const json = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setError(json.error || 'Action failed.'); return }
    setMessage(''); setDetails(''); await load()
  }

  async function uploadDelivery() {
    if (!deliveryFile) return
    setBusy(true); const form=new FormData(); form.set('file',deliveryFile)
    const response=await fetch(`/api/projects/${id}/deliveries`,{method:'POST',body:form,credentials:'include'});const json=await response.json().catch(()=>({}));setBusy(false)
    if(!response.ok){setError(json.error||'Upload failed.');return}setDeliveryFile(null);await load()
  }

  async function createPortal() {
    setBusy(true);const response=await fetch(`/api/projects/${id}/operations`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({type:'create_client_portal'})});const json=await response.json();setBusy(false)
    if(!response.ok){setError(json.error||'Could not create portal.');return}setPortalUrl(`${window.location.origin}${json.portalPath}`)
  }

  async function createRevisionInvoice(revisionId:string) {
    setBusy(true);const response=await fetch(`/api/projects/${id}/operations`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({type:'create_revision_invoice',revisionId})});const json=await response.json();setBusy(false)
    if(!response.ok){setError(json.error||'Could not create invoice.');return}window.open(json.invoicePath,'_blank','noopener,noreferrer')
  }

  if (!data) return <main className="mx-auto max-w-6xl p-6 text-sm text-[#a9bbb5]">{error || 'Loading project operations…'}</main>
  const project = data.project
  const status = String(project.operations_status || 'awaiting_payment').replaceAll('_', ' ')
  const canManage = data.actor === 'seller' || data.actor === 'admin'
  const offered = data.actor === 'freelancer' && project.assignment_status === 'offered'

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#a9bbb5]"><ArrowLeft size={15}/> Back to workspace</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d8b45a]">Project operations</p><h1 className="mt-1 font-display text-3xl font-extrabold text-white">{String(project.title)}</h1></div>
        <span className="rounded-full border border-[#36534a] bg-[#0b2420] px-4 py-2 text-sm capitalize text-[#d9e0dc]">{status}</span>
      </div>
      {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

      {offered && <section className="mt-6 rounded-2xl border border-[rgba(216,180,90,.4)] bg-[rgba(216,180,90,.08)] p-5"><h2 className="font-display text-lg font-bold">Project invitation</h2><p className="mt-1 text-sm text-[#b8c7c2]">Review the brief and deadline before accepting.</p><div className="mt-4 flex gap-2"><button disabled={busy} onClick={() => act({ type:'respond_assignment', decision:'accepted' })} className="rounded-full bg-[#d8b45a] px-5 py-2 text-sm font-bold text-[#10221f]">Accept</button><button disabled={busy} onClick={() => act({ type:'respond_assignment', decision:'declined' })} className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold">Decline</button></div></section>}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Project brief"><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[#c7d3ce]">{String(project.description || '')}</pre></Card>
          <Card title="Messages" icon={<MessageSquare size={17}/>}>
            <div className="space-y-3">{data.messages.length ? data.messages.map((row) => <div key={row.id} className="rounded-xl bg-white/[.04] p-3"><p className="text-xs capitalize text-[#81948e]">{String(row.author_kind)} · {date(row.created_at)}</p><p className="mt-1 text-sm text-[#d9e0dc]">{String(row.body)}</p></div>) : <Empty text="No project messages yet."/>}</div>
            <div className="mt-4 flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} placeholder="Write a project update" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#071b19] px-3 py-2.5 text-sm"/><button disabled={busy || !message.trim()} onClick={() => act({type:'message', body:message})} className="rounded-xl border border-[#5a4a28] px-4 text-sm font-bold text-[#e4c979]">Send</button></div>
          </Card>
          <Card title="Deliveries and revisions" icon={<RefreshCw size={17}/>}>
            {data.deliveries.length ? data.deliveries.map((row) => <div key={row.id} className="mb-2 rounded-xl bg-white/[.04] p-3 text-sm">Version {String(row.version)} · {String(row.file_name)}</div>) : <Empty text="No delivery has been submitted."/>}
            {canManage && project.operations_status === 'delivered' && <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => act({type:'approve_delivery'})} className="rounded-full bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f]">Approve delivery</button></div>}
            {canManage && <div className="mt-4"><textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={3000} placeholder="Describe the requested changes" className="min-h-24 w-full rounded-xl border border-white/10 bg-[#071b19] p-3 text-sm"/><button disabled={busy || !details.trim()} onClick={() => act({type:'request_revision', details})} className="mt-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold">Request revision</button></div>}
            {data.actor === 'freelancer' && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="file" onChange={e=>setDeliveryFile(e.target.files?.[0]||null)} className="min-w-0 flex-1 rounded-xl border border-white/10 p-2 text-sm"/><button disabled={busy||!deliveryFile} onClick={uploadDelivery} className="rounded-full bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f]">Upload delivery</button></div>}
            <div className="mt-4 space-y-2">{data.revisions.map((row) => <div key={row.id} className="rounded-xl border border-white/5 p-3 text-sm"><b>Revision {String(row.request_number)}</b> · {row.included ? 'Included' : `$${Number(row.price_usd).toFixed(2)} payment ${String(row.payment_status)}`}<p className="mt-1 text-[#a9bbb5]">{String(row.details)}</p>{canManage&&!row.included&&row.payment_status==='pending'&&<button onClick={()=>createRevisionInvoice(row.id)} className="mt-2 rounded-full border border-[#5a4a28] px-3 py-1.5 text-xs font-bold text-[#e4c979]">Create payment link</button>}</div>)}</div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Assignment" icon={<UserRound size={17}/>}><Info label="Status" value={String(project.assignment_status || 'unassigned')}/><Info label="Due" value={project.delivery_due_at ? date(String(project.delivery_due_at)) : 'Not set'}/>{canManage && <div className="mt-4 space-y-2"><select value={freelancerId} onChange={e=>setFreelancerId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-2.5 text-sm"><option value="">Choose an available freelancer</option>{freelancers.map(f=><option key={f.user_id} value={f.user_id}>{f.display_name} · {f.category}{f.availability.typical_turnaround_days?` · ${f.availability.typical_turnaround_days}d`:''}</option>)}</select><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-2.5 text-sm"/><button disabled={busy || !freelancerId.trim()} onClick={() => act({type:project.assigned_freelancer_id ? 'reassign':'assign', freelancerId, dueAt: dueAt || undefined})} className="w-full rounded-full border border-[#5a4a28] px-4 py-2 text-sm font-bold text-[#e4c979]">{project.assigned_freelancer_id ? 'Reassign' : 'Send assignment'}</button></div>}</Card>
          {canManage&&<Card title="Client portal"><button disabled={busy} onClick={createPortal} className="w-full rounded-full border border-[#5a4a28] px-4 py-2 text-sm font-bold text-[#e4c979]">Create or rotate secure link</button>{portalUrl&&<div className="mt-3"><input readOnly value={portalUrl} className="w-full rounded-xl border border-white/10 bg-[#071b19] px-3 py-2 text-xs"/><button onClick={()=>navigator.clipboard.writeText(portalUrl)} className="mt-2 text-xs font-bold text-[#e4c979]">Copy link</button></div>}</Card>}
          <Card title="Payout" icon={<CheckCircle2 size={17}/>}><Info label="Amount" value={`$${Number(project.freelancer_payout_amount || 0).toFixed(2)}`}/><Info label="State" value={String(project.freelancer_payout_status || 'not earned')}/><p className="mt-3 text-xs leading-5 text-[#81948e]">Approval makes earnings releasable. Transfer still requires the protected payout process.</p></Card>
          <Card title="Dispute" icon={<ShieldAlert size={17}/>}><textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={3000} placeholder="Explain the issue (at least 10 characters)" className="min-h-24 w-full rounded-xl border border-white/10 bg-[#071b19] p-3 text-sm"/><button disabled={busy || details.trim().length < 10} onClick={() => act({type:'open_dispute', reason:details})} className="mt-2 rounded-full border border-red-400/30 px-4 py-2 text-sm font-bold text-red-200">Open dispute</button></Card>
          <Card title="Audit trail" icon={<Clock size={17}/>}><div className="space-y-3">{data.events.length ? data.events.map((row) => <div key={row.id} className="border-s border-white/10 ps-3"><p className="text-sm capitalize">{String(row.event_type).replaceAll('_',' ')}</p><p className="text-xs text-[#718781]">{date(row.created_at)}</p></div>) : <Empty text="No recorded events yet."/>}</div></Card>
        </div>
      </div>
    </main>
  )
}

function Card({title,icon,children}:{title:string;icon?:React.ReactNode;children:React.ReactNode}) { return <section className="rounded-2xl border border-[#1e3d36] bg-[#0b2420] p-5"><h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">{icon}{title}</h2>{children}</section> }
function Info({label,value}:{label:string;value:string}) { return <div className="mb-2 flex justify-between gap-3 text-sm"><span className="text-[#81948e]">{label}</span><span className="capitalize text-[#d9e0dc]">{value.replaceAll('_',' ')}</span></div> }
function Empty({text}:{text:string}) { return <p className="text-sm text-[#718781]">{text}</p> }
function date(value: unknown) { return value ? new Date(String(value)).toLocaleString() : '—' }
