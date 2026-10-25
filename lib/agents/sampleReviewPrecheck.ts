/**
 * Sample review pre-check helpers (Agent A).
 * Notify-only: never approve/reject/price.
 */

export type ChecklistItem = {
  key: string
  ok: boolean
  detail: string
}

export type PrecheckVerdict = {
  verdict: 'ready_for_human_review' | 'needs_attention'
  checklist: ChecklistItem[]
}

/** Detect phone/email/whatsapp/telegram contact patterns in free text. */
export function detectContactLeak(text: string): string[] {
  const hits: string[] = []
  const t = text || ''
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(t)) hits.push('email')
  if (/(?:whatsapp|wa\.me|api\.whatsapp)/i.test(t)) hits.push('whatsapp')
  if (/(?:t\.me\/|telegram\.me\/|telegram)/i.test(t)) hits.push('telegram')
  if (/(?:\+?\d[\d\s().-]{7,}\d)/.test(t)) hits.push('phone')
  return hits
}

export function matchMagicBytes(
  bytes: Uint8Array,
  expected: 'image' | 'pdf' | 'video' | null,
): boolean {
  if (!expected || bytes.length < 4) return false
  const b = bytes
  if (expected === 'image') {
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true
    if (
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
    )
      return true
    return false
  }
  if (expected === 'pdf') {
    return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
  }
  if (expected === 'video') {
    if (b.length >= 8) {
      const box = String.fromCharCode(b[4], b[5], b[6], b[7])
      if (box === 'ftyp') return true
    }
    return false
  }
  return false
}

export function validatePriceTurnaround(input: {
  priceUsd: number | null | undefined
  turnaroundDays: number | null | undefined
}): ChecklistItem[] {
  const items: ChecklistItem[] = []
  const days = input.turnaroundDays
  if (days == null || !Number.isInteger(days) || days < 1 || days > 30) {
    items.push({ key: 'turnaround', ok: false, detail: 'turnaround_days must be 1–30' })
  } else {
    items.push({ key: 'turnaround', ok: true, detail: `${days} day(s)` })
  }
  const price = input.priceUsd
  if (price == null) {
    items.push({ key: 'price', ok: true, detail: 'Price on request' })
  } else if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    items.push({ key: 'price', ok: false, detail: 'price_usd out of range' })
  } else {
    items.push({ key: 'price', ok: true, detail: `$${price}` })
  }
  return items
}

export function buildPrecheckVerdict(input: {
  title: string
  description: string
  rightsAttested: boolean
  fileCount: number
  hasCost: boolean
  hasProfile: boolean
  priceUsd?: number | null
  turnaroundDays?: number | null
  magicFailures?: number
}): PrecheckVerdict {
  const checklist: ChecklistItem[] = []

  checklist.push({
    key: 'rights',
    ok: input.rightsAttested,
    detail: input.rightsAttested ? 'rights attested' : 'missing rights attestation',
  })
  checklist.push({
    key: 'files',
    ok: input.fileCount >= 1,
    detail: input.fileCount >= 1 ? `${input.fileCount} file(s)` : 'no files',
  })
  checklist.push({
    key: 'cost',
    ok: input.hasCost,
    detail: input.hasCost ? 'cost on file' : 'missing cost row',
  })
  checklist.push({
    key: 'profile',
    ok: input.hasProfile,
    detail: input.hasProfile ? 'freelancer profile present' : 'missing freelancer profile',
  })

  const leaks = detectContactLeak(`${input.title}\n${input.description}`)
  checklist.push({
    key: 'contact_leak',
    ok: leaks.length === 0,
    detail: leaks.length === 0 ? 'no contact patterns in text' : `possible: ${leaks.join(', ')}`,
  })

  checklist.push(...validatePriceTurnaround({
    priceUsd: input.priceUsd,
    turnaroundDays: input.turnaroundDays,
  }))

  if (input.magicFailures != null) {
    checklist.push({
      key: 'magic_bytes',
      ok: input.magicFailures === 0,
      detail:
        input.magicFailures === 0
          ? 'file headers look valid'
          : `${input.magicFailures} file(s) failed header check`,
    })
  }

  const needsAttention = checklist.some((c) => !c.ok)
  return {
    verdict: needsAttention ? 'needs_attention' : 'ready_for_human_review',
    checklist,
  }
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
