import { NextResponse } from 'next/server'

/**
 * Sliding-window rate limiter (priority):
 * 1. Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * 2. Supabase table `rate_limit_buckets` via service role (migration required)
 * 3. In-memory Map — last resort, ineffective across Vercel instances; fail-open
 */

type Bucket = { count: number; resetAt: number }
const memory = new Map<string, Bucket>()

export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  return 'unknown'
}

export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
  backend: 'upstash' | 'supabase' | 'memory' | 'fail-open'
}

async function upstashLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const redisKey = `rl:${key}`
    const incrRes = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(windowMs), 'NX'],
        ['PTTL', redisKey],
      ]),
    })
    if (!incrRes.ok) return null
    const data = (await incrRes.json()) as Array<{ result?: number }>
    const count = Number(data?.[0]?.result ?? 0)
    const ttl = Number(data?.[2]?.result ?? windowMs)
    const reset = Date.now() + (ttl > 0 ? ttl : windowMs)
    return {
      success: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      reset,
      backend: 'upstash',
    }
  } catch (err) {
    console.warn('[rateLimit] upstash error', err instanceof Error ? err.message : 'error')
    return null
  }
}

async function supabaseLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !service) return null
  try {
    const now = Date.now()
    const windowStart = new Date(now - (now % windowMs)).toISOString()
    const bucketKey = `${key}:${windowStart}`
    const getRes = await fetch(
      `${base}/rest/v1/rate_limit_buckets?key=eq.${encodeURIComponent(bucketKey)}&select=count,window_start`,
      {
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
        },
      },
    )
    if (getRes.status === 404 || getRes.status === 406) {
      console.warn('[rateLimit] rate_limit_buckets missing — apply migration (fail-open path)')
      return null
    }
    if (!getRes.ok) return null
    const rows = (await getRes.json()) as Array<{ count: number }>
    const current = rows[0]?.count ?? 0
    const next = current + 1
    if (current === 0) {
      const ins = await fetch(`${base}/rest/v1/rate_limit_buckets`, {
        method: 'POST',
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ key: bucketKey, count: 1, window_start: windowStart, updated_at: new Date().toISOString() }),
      })
      if (!ins.ok && ins.status !== 409) return null
    } else {
      const upd = await fetch(
        `${base}/rest/v1/rate_limit_buckets?key=eq.${encodeURIComponent(bucketKey)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: service,
            Authorization: `Bearer ${service}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ count: next, updated_at: new Date().toISOString() }),
        },
      )
      if (!upd.ok) return null
    }
    const reset = now - (now % windowMs) + windowMs
    return {
      success: next <= limit,
      limit,
      remaining: Math.max(0, limit - next),
      reset,
      backend: 'supabase',
    }
  } catch (err) {
    console.warn('[rateLimit] supabase limiter error', err instanceof Error ? err.message : 'error')
    return null
  }
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = memory.get(key)
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs }
    memory.set(key, bucket)
    return { success: true, limit, remaining: limit - 1, reset: bucket.resetAt, backend: 'memory' }
  }
  existing.count += 1
  return {
    success: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: existing.resetAt,
    backend: 'memory',
  }
}

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  try {
    const remote = await upstashLimit(key, opts.limit, opts.windowMs)
    if (remote) return remote
    const table = await supabaseLimit(key, opts.limit, opts.windowMs)
    if (table) return table
    console.warn('[rateLimit] using in-memory fallback (not shared across serverless instances)')
    return memoryLimit(key, opts.limit, opts.windowMs)
  } catch (err) {
    console.warn('[rateLimit] fail-open', err instanceof Error ? err.message : 'error')
    return {
      success: true,
      limit: opts.limit,
      remaining: opts.limit,
      reset: Date.now() + opts.windowMs,
      backend: 'fail-open',
    }
  }
}

export function rateLimitResponse(result: RateLimitResult, message = 'Too many requests. Please try again shortly.') {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'RATE_LIMITED', message },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  )
}

export async function limitAuth(request: Request) {
  return rateLimit(`auth:${clientIp(request)}`, { limit: 5, windowMs: 60_000 })
}

export async function limitWrite(userId: string) {
  return rateLimit(`write:${userId}`, { limit: 20, windowMs: 60_000 })
}

export async function limitPublicForm(request: Request) {
  return rateLimit(`form:${clientIp(request)}`, { limit: 5, windowMs: 600_000 })
}
