import { adminClient } from '@/lib/adminCore'
import {
  buildPrecheckVerdict,
  escapeHtml,
  matchMagicBytes,
  type PrecheckVerdict,
} from '@/lib/agents/sampleReviewPrecheck'
import { notifyAdminChannels } from '@/lib/agents/notifyAdmin'
import { sampleFileKind } from '@/lib/samples'

export type SampleReviewAgentResult = {
  processed: boolean
  skipped?: string
  verdict?: PrecheckVerdict['verdict']
}

function agentsEnabled(): boolean {
  return process.env.AGENTS_ENABLED === 'true'
}

/** Best-effort idempotency via agent_events when the table exists. */
async function claimEvent(idempotencyKey: string, sampleId: string): Promise<'claimed' | 'duplicate' | 'no_table'> {
  try {
    const admin = adminClient()
    const { error } = await admin.from('agent_events').insert({
      idempotency_key: idempotencyKey,
      agent: 'sample_review',
      entity_id: sampleId,
    })
    if (!error) return 'claimed'
    if (error.code === '23505') return 'duplicate'
    if (/does not exist|relation|permission/i.test(error.message || '')) return 'no_table'
    console.error('[sampleReviewAgent] claimEvent', error.message)
    return 'no_table'
  } catch (e) {
    console.error('[sampleReviewAgent] claimEvent failed', e)
    return 'no_table'
  }
}

export async function runSampleReviewAgent(input: {
  sampleId: string
  updatedAt?: string | null
}): Promise<SampleReviewAgentResult> {
  if (!agentsEnabled()) {
    return { processed: false, skipped: 'AGENTS_DISABLED' }
  }

  const admin = adminClient()
  const { data: sample, error } = await admin
    .from('samples')
    .select(
      'id, title, category, description, status, price_usd, turnaround_days, rights_attested_at, updated_at, owner_id',
    )
    .eq('id', input.sampleId)
    .maybeSingle()

  if (error || !sample) {
    return { processed: false, skipped: 'SAMPLE_NOT_FOUND' }
  }
  if (sample.status !== 'pending_review') {
    return { processed: false, skipped: 'NOT_PENDING_REVIEW' }
  }

  const updatedAt = input.updatedAt || sample.updated_at || ''
  const idempotencyKey = `sample_review:${sample.id}:${updatedAt}`
  const claim = await claimEvent(idempotencyKey, sample.id)
  if (claim === 'duplicate') {
    return { processed: false, skipped: 'DUPLICATE' }
  }

  const [{ count: fileCount }, costRow, profileRow, files] = await Promise.all([
    admin
      .from('sample_files')
      .select('id', { count: 'exact', head: true })
      .eq('sample_id', sample.id)
      .then((r) => ({ count: r.count ?? 0 })),
    admin.from('sample_costs').select('sample_id').eq('sample_id', sample.id).maybeSingle(),
    admin.from('freelancer_profiles').select('user_id').eq('user_id', sample.owner_id).maybeSingle(),
    admin
      .from('sample_files')
      .select('storage_path, kind, mime')
      .eq('sample_id', sample.id)
      .order('sort_order', { ascending: true }),
  ])

  let magicFailures = 0
  const fileRows = files.data ?? []
  for (const f of fileRows.slice(0, 5)) {
    try {
      const kind =
        (f.kind as 'image' | 'pdf' | 'video' | null) ||
        sampleFileKind(String(f.mime || '').toLowerCase())
      const dl = await admin.storage.from('sample-originals').download(f.storage_path)
      if (dl.error || !dl.data) {
        magicFailures += 1
        continue
      }
      const buf = new Uint8Array(await dl.data.arrayBuffer())
      const head = buf.slice(0, 32)
      if (!matchMagicBytes(head, kind)) magicFailures += 1
    } catch {
      magicFailures += 1
    }
  }

  const verdict = buildPrecheckVerdict({
    title: sample.title || '',
    description: sample.description || '',
    rightsAttested: Boolean(sample.rights_attested_at),
    fileCount,
    hasCost: Boolean(costRow.data),
    hasProfile: Boolean(profileRow.data),
    priceUsd: sample.price_usd,
    turnaroundDays: sample.turnaround_days,
    magicFailures,
  })

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://dropverse-nu.vercel.app'
  const adminLink = `${site.replace(/\/$/, '')}/admin/samples`

  const lines = verdict.checklist
    .map((c) => `${c.ok ? '✅' : '⚠️'} ${c.key}: ${c.detail}`)
    .join('\n')

  const plain = [
    `Sample review pre-check: ${verdict.verdict}`,
    `Title: ${sample.title}`,
    `Category: ${sample.category}`,
    `Id: ${sample.id}`,
    lines,
    `Admin: ${adminLink}`,
  ].join('\n')

  const html = [
    `<b>Sample review pre-check</b>: ${escapeHtml(verdict.verdict)}`,
    `<b>Title</b>: ${escapeHtml(sample.title || '')}`,
    `<b>Category</b>: ${escapeHtml(sample.category || '')}`,
    `<b>Id</b>: <code>${escapeHtml(sample.id)}</code>`,
    ...verdict.checklist.map(
      (c) => `${c.ok ? '✅' : '⚠️'} <b>${escapeHtml(c.key)}</b>: ${escapeHtml(c.detail)}`,
    ),
    `<a href="${escapeHtml(adminLink)}">Open admin samples</a>`,
  ].join('\n')

  await notifyAdminChannels(html, plain)
  return { processed: true, verdict: verdict.verdict }
}
