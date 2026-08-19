'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2 } from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { AGENCY_TYPES, PLAN_CONFIG, TEAM_SIZES, minTeamHeadcount, type PlanId } from '../../../lib/planConfig'
import { slugify, type OrgRow } from '../../../lib/orgs'

const STEPS = ['Agency Name', 'Agency Type', 'Team Size', 'Choose Plan', 'Confirm']

export default function CreateOrgPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('')
  const [teamSize, setTeamSize] = useState<string>('')
  const [plan, setPlan] = useState<PlanId>('AGENCY')
  // Plans whose capacity cannot hold the chosen team size are disabled.
  const compatiblePlans = PLAN_CONFIG.filter(
    (p) => p.maxMembers === null || p.maxMembers >= minTeamHeadcount(teamSize),
  )
  const isPlanCompatible = (id: PlanId) => compatiblePlans.some((p) => p.id === id)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)

  // Auto-select a compatible plan whenever the team size or current plan changes.
  useEffect(() => {
    if (!teamSize) return
    if (!compatiblePlans.some((p) => p.id === plan)) {
      setPlan(compatiblePlans[0]?.id ?? 'AGENCY')
    }
  }, [teamSize, plan, compatiblePlans])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      let session = null
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) { session = data.session; break }
        if (i < 4) await new Promise((r) => setTimeout(r, 800))
      }
      if (cancelled) return
      if (!session) { window.location.assign('/login?redirect=%2Fdashboard%2Fcreate-org'); return }
      setAuthed(true)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function createOrg() {
    if (!name.trim()) return
    const supabase = createClient()
    setCreating(true)
    setError(null)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      setError('Your session expired. Please sign in again.')
      setCreating(false)
      return
    }
    // Server-side (RLS) creates the org; slug uniqueness may fail → retry with hash suffix.
    let slug = slugify(name)
    const attempts = 3
    let created: OrgRow | null = null
    for (let i = 0; i < attempts; i++) {
      const { data, error: e } = await supabase
        .from('organizations')
        .insert({
          name: name.trim(),
          slug: slug + (i === 0 ? '' : '-' + Math.random().toString(36).slice(2, 8)),
          type: 'agency',
          plan,
          owner_id: session.user.id,
          industry: type,
          team_size: teamSize,
          status: 'active',
        })
        .select('id')
        .single()
      if (e) {
        if (e.code === '23505') { slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 8); continue }
        if (e.code === '45002') { setError('This plan does not support your selected team size. Please choose a different plan.'); break }
        setError(e.message)
        break
      }
      const { data: mem } = await supabase
        .from('organization_members')
        .insert({ organization_id: (data as { id: string }).id, user_id: session.user.id, role: 'OWNER', status: 'active', joined_at: new Date().toISOString() })
        .select()
        .single()
      if (mem) created = { id: (data as { id: string }).id, name: name.trim(), plan, type: 'agency' } as OrgRow
      break
    }
    // Create default settings row
    if (created) {
      await supabase.from('organization_settings').upsert({ organization_id: created.id }, { onConflict: 'organization_id' })
    }
    setCreating(false)
    if (created) router.push('/dashboard')
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#071f1d]"><span className="text-sm text-[#849792]">Loading…</span></main>
  }

  const chosenPlan = PLAN_CONFIG.find((p) => p.id === plan)!
  const canNext =
    (step === 0 && name.trim().length >= 2) ||
    (step === 1 && !!type) ||
    (step === 2 && !!teamSize) ||
    step === 3

  return (
    <main className="min-h-screen bg-[#071f1d] pt-28">
      <div className="container mx-auto max-w-2xl px-5">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#8fa29c] transition hover:text-[#d8b45a]">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Create an Agency</h1>
            <p className="text-sm text-[#849792]">Set up your team workspace in a few steps.</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-8 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i === step ? 'bg-[#d8b45a] text-[#10221f]' : i < step ? 'border border-[#d8b45a]/50 text-[#d8b45a]' : 'border border-white/15 text-[#5f726c]'}`}>
                {i < step ? <CheckCircle2 size={15} /> : i + 1}
              </span>
              {i < STEPS.length - 1 && <span className={`h-px w-8 ${i < step ? 'bg-[#d8b45a]/50' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#6e817c]">{STEPS[step]}</p>

        <div className="card mt-6 rounded-2xl p-6">
          {error && (
            <div className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>
          )}

          {step === 0 && (
            <div>
              <label className="text-sm font-semibold text-[#c1cbc7]">Agency Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vertex Media"
                maxLength={60}
                className="mt-3 w-full rounded-xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3.5 text-[#f7f4ec] outline-none transition focus:border-[rgba(216,180,90,0.55)]"
              />
              <p className="mt-2 text-xs text-[#6e817c]">This is how your workspace appears to your team.</p>
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="text-sm font-semibold text-[#c1cbc7]">Agency Type</label>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {AGENCY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition ${
                      type === t
                        ? 'border-[rgba(216,180,90,0.60)] bg-[rgba(216,180,90,0.10)] text-[#e4c979]'
                        : 'border-white/10 bg-white/[.03] text-[#c1cbc7] hover:border-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="text-sm font-semibold text-[#c1cbc7]">Team Size</label>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {TEAM_SIZES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTeamSize(t)}
                    className={`rounded-xl border px-4 py-3.5 text-center text-sm font-semibold transition ${
                      teamSize === t
                        ? 'border-[rgba(216,180,90,0.60)] bg-[rgba(216,180,90,0.10)] text-[#e4c979]'
                        : 'border-white/10 bg-white/[.03] text-[#c1cbc7] hover:border-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#6e817c]">Estimated — you can adjust your plan anytime.</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="text-sm font-semibold text-[#c1cbc7]">Choose Plan</label>
              <div className="mt-3 space-y-3">
                {PLAN_CONFIG.map((p) => {
                  const compatible = isPlanCompatible(p.id)
                  return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!compatible}
                    onClick={() => {
                      if (!compatible) return
                      setPlan(p.id)
                    }}
                    aria-disabled={!compatible}
                    className={`w-full rounded-xl border px-5 py-4 text-left transition ${
                      plan === p.id
                        ? 'border-[rgba(216,180,90,0.60)] bg-[rgba(216,180,90,0.10)]'
                        : compatible
                          ? 'border-white/10 bg-white/[.03] hover:border-white/20'
                          : 'cursor-not-allowed border-white/10 bg-white/[.02] opacity-40'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-[#e8efe9]">{p.displayName}</span>
                      <span className={`text-sm font-bold ${p.enterprise ? 'text-[#849792]' : 'text-[#d8b45a]'}`}>
                        {p.enterprise ? 'Custom pricing' : p.price === 0 ? 'Free' : `$${p.price}/mo`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#849792]">{p.maxMembers === null ? 'Unlimited members' : p.maxMembers === 1 ? '1 user' : `Up to ${p.maxMembers} members`}{!compatible ? ' — too small for your team size' : ''}</p>
                  </button>
                  )
                })}
              </div>
              {!compatiblePlans.some((p) => p.id === plan) && compatiblePlans.length > 0 && (
                <p className="mt-3 text-xs text-[#849792]">Auto-selected a plan that fits your team size.</p>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-sm font-semibold text-[#c1cbc7]">Confirm your agency</p>
              <dl className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[.02] p-5 text-sm">
                <div className="flex justify-between"><dt className="text-[#849792]">Name</dt><dd className="font-semibold text-[#e8efe9]">{name}</dd></div>
                <div className="flex justify-between"><dt className="text-[#849792]">Type</dt><dd className="font-semibold text-[#e8efe9]">{type}</dd></div>
                <div className="flex justify-between"><dt className="text-[#849792]">Team size</dt><dd className="font-semibold text-[#e8efe9]">{teamSize}</dd></div>
                <div className="flex justify-between"><dt className="text-[#849792]">Plan</dt><dd className="font-semibold text-[#e4c979]">{chosenPlan.displayName}{chosenPlan.enterprise ? '' : ` — $${chosenPlan.price}/month`}</dd></div>
              </dl>
              {plan !== 'SOLO' && (
                <p className="mt-4 rounded-lg border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] px-4 py-3 text-xs text-[#b9a76f]">
                  Billing integration is coming soon — no payment is required right now.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between pb-16">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || creating}
            className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-[#c1cbc7] transition hover:border-white/30 disabled:opacity-40"
          >
            <ArrowLeft size={16} /> Previous
          </button>
          {step < 4 ? (
            <button
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-40"
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={createOrg}
              disabled={creating}
              className="flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create Organization'} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
