import { NextResponse } from 'next/server'

/**
 * Sliding-window rate limiter.
 * Prefer Upstash when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 * Falls back to in-memory Map (per-instance only on serverless — fail open on errors).
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
    }
  } catch (err) {
    console.warn('[rateLimit] upstash unavailable, fail-open', err instanceof Error ? err.message : 'error')
    return null
  }
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = memory.get(key)
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs }
    memory.set(key, bucket)
    return { success: true, limit, remaining: limit - 1, reset: bucket.resetAt }
  }
  existing.count += 1
  return {
    success: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: existing.resetAt,
  }
}

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  try {
    const remote = await upstashLimit(key, opts.limit, opts.windowMs)
    if (remote) return remote
    return memoryLimit(key, opts.limit, opts.windowMs)
  } catch (err) {
    console.warn('[rateLimit] fail-open', err instanceof Error ? err.message : 'error')
    return { success: true, limit: opts.limit, remaining: opts.limit, reset: Date.now() + opts.windowMs }
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

/** Auth endpoints: 5 / minute / IP */
export async function limitAuth(request: Request) {
  const ip = clientIp(request)
  return rateLimit(`auth:${ip}`, { limit: 5, windowMs: 60_000 })
}

/** Authenticated writes: 20 / minute / user */
export async function limitWrite(userId: string) {
  return rateLimit(`write:${userId}`, { limit: 20, windowMs: 60_000 })
}

/** Public forms: 5 / 10 minutes / IP */
export async function limitPublicForm(request: Request) {
  const ip = clientIp(request)
  return rateLimit(`form:${ip}`, { limit: 5, windowMs: 600_000 })
}
