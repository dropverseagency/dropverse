import { NextResponse } from 'next/server'

/** Distributed rate limiting: atomic Upstash Lua -> atomic Supabase RPC -> bounded local fallback. */
type Bucket = { count: number; resetAt: number }
const memory = new Map<string, Bucket>()

export function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  const xff = request.headers.get('x-forwarded-for')
  if (xff) { const first = xff.split(',')[0]?.trim(); if (first) return first }
  return 'unknown'
}
export type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number; backend: 'upstash' | 'supabase' | 'memory' }

async function upstashLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const script = "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; local ttl=redis.call('PTTL',KEYS[1]); return {count,ttl}"
  try {
    const response = await fetch(url, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify(['EVAL',script,'1',`rl:${key}`,String(windowMs)]), cache:'no-store' })
    if (!response.ok) return null
    const payload = await response.json() as { result?: unknown }, result = payload?.result
    if (!Array.isArray(result) || result.length < 2) return null
    const count = Number(result[0]), ttl = Number(result[1])
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) return null
    return { success:count<=limit, limit, remaining:Math.max(0,limit-count), reset:Date.now()+Math.max(1,ttl), backend:'upstash' }
  } catch (error) { console.warn('[rateLimit] Upstash unavailable; trying next backend', error instanceof Error ? error.message : 'error'); return null }
}
async function supabaseLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !service) return null
  try {
    const response = await fetch(`${base.replace(/\/$/,'')}/rest/v1/rpc/consume_rate_limit_bucket`, {
      method:'POST', headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_key:key,p_limit:limit,p_window_ms:windowMs}), cache:'no-store'
    })
    if (!response.ok) { console.warn('[rateLimit] Supabase atomic limiter unavailable',response.status); return null }
    const result = await response.json() as {success?:unknown;limit?:unknown;remaining?:unknown;reset?:unknown}
    if (typeof result?.success !== 'boolean') return null
    return {success:result.success,limit:Number(result.limit??limit),remaining:Number(result.remaining??0),reset:Number(result.reset??Date.now()+windowMs),backend:'supabase'}
  } catch (error) { console.warn('[rateLimit] Supabase limiter unavailable; trying local limiter',error instanceof Error?error.message:'error'); return null }
}
function memoryLimit(key:string,limit:number,windowMs:number):RateLimitResult {
  const now=Date.now()
  if(memory.size>10000) for(const [k,v] of memory) if(v.resetAt<=now) memory.delete(k)
  const existing=memory.get(key)
  if(!existing||existing.resetAt<=now){const bucket={count:1,resetAt:now+windowMs};memory.set(key,bucket);return{success:true,limit,remaining:limit-1,reset:bucket.resetAt,backend:'memory'}}
  existing.count++;return{success:existing.count<=limit,limit,remaining:Math.max(0,limit-existing.count),reset:existing.resetAt,backend:'memory'}
}
export async function rateLimit(key:string,opts:{limit:number;windowMs:number}):Promise<RateLimitResult>{
  const safeKey=String(key||'unknown').slice(0,450)
  const remote=await upstashLimit(safeKey,opts.limit,opts.windowMs);if(remote)return remote
  const table=await supabaseLimit(safeKey,opts.limit,opts.windowMs);if(table)return table
  console.warn('[rateLimit] using bounded in-memory fallback; distributed backend unavailable')
  return memoryLimit(safeKey,opts.limit,opts.windowMs)
}
export function rateLimitResponse(result:RateLimitResult,message='Too many requests. Please try again shortly.'){
  const retryAfter=Math.max(1,Math.ceil((result.reset-Date.now())/1000))
  return NextResponse.json({error:'RATE_LIMITED',message},{status:429,headers:{'Retry-After':String(retryAfter),'X-RateLimit-Limit':String(result.limit),'X-RateLimit-Remaining':String(result.remaining)}})
}
export async function limitAuth(request:Request){return rateLimit(`auth:${clientIp(request)}`,{limit:5,windowMs:60000})}
export async function limitWrite(userId:string){return rateLimit(`write:${userId}`,{limit:20,windowMs:60000})}
export async function limitPublicForm(request:Request){return rateLimit(`form:${clientIp(request)}`,{limit:5,windowMs:600000})}
