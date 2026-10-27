'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, ExternalLink, Globe, Save } from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { type OrgRow } from '../../../lib/orgs'
import { planById } from '../../../lib/planConfig'
import AgencyLandingOrders from '../../../components/AgencyLandingOrders'
import AgencyLogoUpload from '../../../components/AgencyLogoUpload'

type Svc = { id: string; title: string; slug: string; description: string }

export default function AgencyLandingDashboardPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [eligible, setEligible] = useState(false)
  const [plan, setPlan] = useState('SOLO')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#e2b656')
  const [logoUrl, setLogoUrl] = useState('')
  const [published, setPublished] = useState(false)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [catalog, setCatalog] = useState<Svc[]>([])
  const [customDomain,setCustomDomain]=useState('')
  const [domainStatus,setDomainStatus]=useState('')

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        window.location.assign('/login?redirect=%2Fdashboard%2Flanding')
        return
      }
      const { data: orgRows } = await supabase
        .from('organizations')
        .select(
          'id, name, slug, type, plan, owner_id, logo_url, description, industry, team_size, status, created_at, updated_at',
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (cancelled) return
      const list = (orgRows as OrgRow[] | null) ?? []
      setOrgs(list)
      if (list[0]) setOrgId(list[0].id)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/agency/landing?organizationId=${encodeURIComponent(orgId)}`)
      const json = await res.json()
      if (cancelled) return
      if (!res.ok) {
        setEligible(false)
        setError(json.error || 'LOAD_FAILED')
        setPlan(orgs.find((o) => o.id === orgId)?.plan || 'SOLO')
        return
      }
      setEligible(true)
      setPlan(json.plan)
      setCatalog(json.catalog || [])
      if (json.page) {
        setDisplayName(json.page.display_name || '')
        setSlug(json.page.slug || '')
        setHeadline(json.page.headline || '')
        setDescription(json.page.description || '')
        setPrimaryColor(json.page.primary_color || '#e2b656')
        setLogoUrl(json.page.logo_url || '')
        setPublished(Boolean(json.page.published))
      } else {
        const org = orgs.find((o) => o.id === orgId)
        setDisplayName(org?.name || '')
        setSlug((org?.slug || org?.name || 'agency').toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      }
      setServiceIds(json.serviceIds || [])
      const domainRes=await fetch(`/api/agency/domain?organizationId=${encodeURIComponent(orgId)}`);const domainJson=await domainRes.json().catch(()=>({}));if(domainJson.domain){setCustomDomain(domainJson.domain.hostname||'');setDomainStatus(domainJson.domain.status||'')}
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, orgs])

  const publicUrl = useMemo(
    () => (typeof window === 'undefined' || !slug ? '' : `${window.location.origin}/a/${slug}`),
    [slug],
  )

  async function save() {
    if (!orgId) return
    setSaving(true)
    setMsg(null)
    setError(null)
    const res = await fetch('/api/agency/landing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: orgId,
        displayName,
        slug,
        headline,
        description,
        primaryColor,
        logoUrl: logoUrl || null,
        serviceIds,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(json.error || 'SAVE_FAILED')
      return
    }
    setSlug(json.slug)
    setMsg('Saved')
  }

  async function togglePublish() {
    if (!orgId) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/agency/landing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId, action: published ? 'unpublish' : 'publish' }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      const msg =
        json.error === 'NO_PACKAGES'
          ? 'Add active packages in Admin → Packages before publishing.'
          : json.error === 'NO_SERVICES'
            ? 'Select at least one service before publishing.'
            : json.error || 'PUBLISH_FAILED'
      setError(msg)
      return
    }
    setPublished(Boolean(json.published))
    setMsg(json.published ? 'Published' : 'Unpublished')
  }

  async function connectDomain(){if(!orgId||!customDomain)return;setSaving(true);setError(null);const response=await fetch('/api/agency/domain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:orgId,hostname:customDomain})});const json=await response.json();setSaving(false);if(!response.ok){setError(json.error||'DOMAIN_FAILED');return}setDomainStatus(json.status);setMsg(`Add CNAME ${json.dns?.name} → ${json.dns?.value}, then refresh this page.`)}

  if (loading) {
    return (
      <main className="min-h-screen grid-bg px-5 py-14 text-center text-sm text-[#849792]">Loading…</main>
    )
  }

  const planMeta = planById(plan as never)

  return (
    <main className="min-h-screen grid-bg px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#9aaca6]"
          >
            <ArrowLeft size={17} />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Agency landing page</h1>
            <p className="text-sm text-[#849792]">Paid-plan branded storefront</p>
          </div>
        </div>
        {!eligible ? (
          <div className="card mt-8 rounded-3xl p-8 text-center">
            <Globe size={28} className="mx-auto text-[#6e817c]" />
            <p className="mt-4 font-semibold">Requires Agency plan or higher</p>
            <p className="mt-2 text-sm text-[#849792]">Current: {planMeta?.displayName || plan}</p>
            <Link
              href="/dashboard/billing"
              className="mt-6 inline-flex rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f]"
            >
              View plans
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="card rounded-3xl p-6 space-y-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm font-mono"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="slug"
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm font-mono"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#e2b656"
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Headline"
              />
              <textarea
                className="w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
              {orgId ? (
                <AgencyLogoUpload orgId={orgId} logoUrl={logoUrl} onLogoUrl={setLogoUrl} />
              ) : null}
            </div>
            <div className="card rounded-3xl p-6 space-y-2">
              <h2 className="font-display font-bold">Services</h2>
              {catalog.map((s) => (
                <label key={s.id} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={() =>
                      setServiceIds((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))
                    }
                  />
                  {s.title}
                </label>
              ))}
            </div>
            <div className="card rounded-3xl p-6"><h2 className="font-display font-bold">Custom domain</h2><p className="mt-1 text-xs text-[#849792]">Connect a domain you own. DNS verification is required before traffic is routed.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={customDomain} onChange={e=>setCustomDomain(e.target.value.toLowerCase())} placeholder="services.example.com" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm"/><button disabled={saving||!customDomain} onClick={connectDomain} className="rounded-full border border-[rgba(216,180,90,.4)] px-4 py-2 text-sm font-bold text-[#e4c979]">Connect domain</button></div>{domainStatus?<p className="mt-2 text-xs text-[#a9bbb5]">Status: <b className="text-white">{domainStatus}</b></p>:null}</div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f]"
              >
                <Save size={16} /> Save
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={togglePublish}
                className="rounded-full border border-[rgba(216,180,90,0.4)] px-5 py-2.5 text-sm font-bold text-[#e4c979]"
              >
                {published ? 'Unpublish' : 'Publish'}
              </button>
              {published && publicUrl ? (
                <>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#d8b45a]"
                  >
                    Open <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(publicUrl)}
                    className="inline-flex items-center gap-1 text-sm text-[#9aaca6]"
                  >
                    <Copy size={14} /> Copy
                  </button>
                </>
              ) : null}
              {msg ? (
                <span className="inline-flex items-center gap-1 text-sm text-[#6fbf73]">
                  <Check size={14} /> {msg}
                </span>
              ) : null}
            </div>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            {orgId ? <AgencyLandingOrders organizationId={orgId} /> : null}
          </div>
        )}
      </div>
    </main>
  )
}
