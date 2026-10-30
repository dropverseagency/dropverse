import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SERVICES = {
  'video-editing': {
    label: 'Video editing',
    queries: ['video editor', 'video editing'],
    terms: /\b(video editor|video editing|video edits?|reels?|short[- ]form|tiktok editor|youtube editor|youtube shorts?)\b/i,
  },
  ugc: {
    label: 'UGC content',
    queries: ['UGC creator', 'UGC video'],
    terms: /\b(ugc|user[- ]generated content|ugc creator|ugc video|product video creator)\b/i,
  },
  'graphic-design': {
    label: 'Graphic design',
    queries: ['graphic designer', 'logo design'],
    terms: /\b(graphic design(?:er)?|logo design(?:er)?|brand identity|branding|visual identity)\b/i,
  },
  'social-media': {
    label: 'Social media',
    queries: ['social media manager', 'social media content'],
    terms: /\b(social media (?:manager|content|management)|content manager|social media agency)\b/i,
  },
  'web-design': {
    label: 'Web design',
    queries: ['web designer', 'website design'],
    terms: /\b(web design(?:er)?|website design(?:er)?|landing page design|shopify (?:store|website))\b/i,
  },
} as const

type ServiceKey = keyof typeof SERVICES
type BlueskyPost = {
  uri?: string
  cid?: string
  author?: { handle?: string; displayName?: string }
  record?: { text?: string; createdAt?: string; reply?: unknown }
  indexedAt?: string
  replyCount?: number
  likeCount?: number
  repostCount?: number
}

function isExplicitServiceRequest(text: string, service: (typeof SERVICES)[ServiceKey]) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length < 25 || !service.terms.test(normalized)) return false

  // Exclude employment ads and general job listings: this tool is for buyers
  // explicitly asking someone to deliver a service.
  const employmentOnly = /\b(full[- ]time|part[- ]time|salary|job opening|career opportunity|internship|employee benefits|apply now|join our team|position available|job description)\b/i
  if (employmentOnly.test(normalized)) return false

  const directIntent = /\\b(looking for|in search of|seeking)\\b|\\bneed(?:s)?\\s+(?:(?:a|an|someone|somebody|help with|services?|freelancer|agency|team)\\b|(?:video|ugc|graphic|social media|web)\\b)|\\b(?:want|wants|wanting) to hire\\b|\\b(?:hire|hiring)\\s+(?:a|an|someone|somebody|freelancer|agency|team)\\b|\\banyone (?:know|recommend)\\b|\\bany recommendations for\\b|\\brecommend me\\b/i
  return directIntent.test(normalized)
}

function publicPostUrl(post: BlueskyPost) {
  const handle = post.author?.handle
  const rkey = post.uri?.split('/').at(-1)
  if (!handle || !rkey || !/^[a-zA-Z0-9.-]+$/.test(handle) || !/^[a-zA-Z0-9]+$/.test(rkey)) return null
  return `https://bsky.app/profile/${handle}/post/${rkey}`
}

function redactContactDetails(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contact details hidden]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[contact details hidden]')
}

function leadScore(text: string) {
  let score = 85
  if (/\$\s?\d|\b(budget|paid|paying|rate|per month|monthly|weekly|ongoing)\b/i.test(text)) score += 8
  if (/\b(agency|team|multiple videos|\d+\s?(?:videos|reels|posts))\b/i.test(text)) score += 4
  return Math.min(score, 99)
}

export async function POST(request: NextRequest) {
  const rate = await rateLimit(`client-finder:${clientIp(request)}`, { limit: 6, windowMs: 60_000 })
  if (!rate.success) return rateLimitResponse(rate, 'Search limit reached. Please wait a minute and try again.')

  let serviceKey: string
  try {
    const body = await request.json()
    serviceKey = typeof body?.service === 'string' ? body.service : ''
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Choose a service category and try again.' }, { status: 400 })
  }

  if (!Object.prototype.hasOwnProperty.call(SERVICES, serviceKey)) {
    return NextResponse.json({ error: 'INVALID_SERVICE', message: 'Choose a supported service category.' }, { status: 400 })
  }

  const service = SERVICES[serviceKey as ServiceKey]
  const results = await Promise.allSettled(service.queries.map(async (query) => {
    const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '100')
    url.searchParams.set('sort', 'latest')
    url.searchParams.set('lang', 'en')

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error(`Bluesky search returned ${response.status}`)
    return await response.json() as { posts?: BlueskyPost[] }
  }))

  const successful = results.filter((result): result is PromiseFulfilledResult<{ posts?: BlueskyPost[] }> => result.status === 'fulfilled')
  if (!successful.length) {
    console.error('[client-finder] all Bluesky searches failed')
    return NextResponse.json(
      { error: 'SOURCE_UNAVAILABLE', message: 'The public search source is temporarily unavailable. Please try again shortly.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const seen = new Set<string>()
  const items = successful
    .flatMap((result) => result.value.posts ?? [])
    .filter((post) => {
      const url = publicPostUrl(post)
      const text = post.record?.text ?? ''
      const createdAt = post.record?.createdAt ?? post.indexedAt
      const timestamp = createdAt ? Date.parse(createdAt) : Number.NaN
      if (!url || !post.uri || seen.has(post.uri)) return false
      if (!Number.isFinite(timestamp) || timestamp < cutoff) return false
      if (post.record?.reply) return false
      if (!isExplicitServiceRequest(text, service)) return false
      seen.add(post.uri)
      return true
    })
    .map((post) => {
      const text = post.record?.text ?? ''
      const createdAt = post.record?.createdAt ?? post.indexedAt ?? new Date().toISOString()
      return {
        id: post.uri as string,
        url: publicPostUrl(post) as string,
        text: redactContactDetails(text).slice(0, 420),
        createdAt,
        service: service.label,
        score: leadScore(text),
        source: 'Bluesky',
      }
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 40)

  return NextResponse.json(
    {
      items,
      source: 'Bluesky',
      searchedAt: new Date().toISOString(),
      partial: successful.length !== service.queries.length,
      note: 'Only public posts with an explicit service request are shown. Open the original post to verify context before contacting the author.',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
