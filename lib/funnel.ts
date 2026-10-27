import { adminClient } from './adminCore'

export type FunnelEventName = 'visit'|'sign_up'|'profile_complete'|'sample_viewed'|'project_created'|'invoice_sent'|'payment_completed'|'freelancer_assigned'|'delivered'|'approved'|'payout_completed'|'repeat_project'|'support_interaction'
export async function recordFunnelEvent(eventName:FunnelEventName, input:{anonymousId?:string;userId?:string;organizationId?:string;projectId?:string;sampleId?:string;invoiceId?:string;amountUsd?:number;metadata?:Record<string,unknown>}={}) {
  try { await adminClient().from('funnel_events').insert({ event_name:eventName, anonymous_id:input.anonymousId?.slice(0,100)||null, user_id:input.userId||null, organization_id:input.organizationId||null, project_id:input.projectId||null, sample_id:input.sampleId||null, invoice_id:input.invoiceId||null, amount_usd:Number.isFinite(input.amountUsd)?input.amountUsd:null, metadata:input.metadata||{} }) } catch (error) { console.error('[funnel]', eventName, error) }
}
