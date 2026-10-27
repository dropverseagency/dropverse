import { NextRequest, NextResponse } from 'next/server'
import { recordFunnelEvent } from '../../../../lib/funnel'
import { clientIp, rateLimit, rateLimitResponse } from '../../../../lib/rateLimit'

export async function POST(request:NextRequest){
  const limit=await rateLimit(`funnel:${clientIp(request)}`,{limit:60,windowMs:60_000});if(!limit.success)return rateLimitResponse(limit)
  const body=await request.json().catch(()=>({})) as {event?:string;anonymousId?:string;sampleId?:string;metadata?:Record<string,unknown>}
  if(!['visit','sample_viewed'].includes(String(body.event)))return NextResponse.json({error:'INVALID_EVENT'},{status:400})
  await recordFunnelEvent(body.event as 'visit'|'sample_viewed',{anonymousId:String(body.anonymousId||'').slice(0,100),sampleId:body.sampleId,metadata:body.metadata})
  return NextResponse.json({ok:true})
}
