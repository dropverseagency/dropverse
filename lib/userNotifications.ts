import { adminClient } from '@/lib/adminCore'

export type UserNotificationInput = {
  userId: string
  type: string
  title: string
  body?: string
  href?: string
  entityType?: string
  entityId?: string
}

/**
 * Best-effort write of an in-app user notification.
 * Never throws. No-op if the table is not migrated yet.
 */
export async function createUserNotification(input: UserNotificationInput): Promise<void> {
  try {
    if (!input.userId || !input.type || !input.title) return
    const admin = adminClient()
    const { error } = await admin.from('user_notifications').insert({
      user_id: input.userId,
      type: input.type.slice(0, 64),
      title: input.title.slice(0, 200),
      body: (input.body || '').slice(0, 1000),
      href: input.href ? input.href.slice(0, 300) : null,
      entity_type: input.entityType ? input.entityType.slice(0, 64) : null,
      entity_id: input.entityId ? input.entityId.slice(0, 80) : null,
    })
    if (error) {
      if (/does not exist|relation|permission/i.test(error.message || '')) return
      console.error('[userNotifications]', error.message)
    }
    void sendExternalNotification(input)
  } catch (e) {
    console.error('[userNotifications]', e)
  }
}

async function sendExternalNotification(input: UserNotificationInput) {
  try {
    const admin=adminClient();const [{data:userResult},{data:profile}]=await Promise.all([admin.auth.admin.getUserById(input.userId),admin.from('profiles').select('phone,whatsapp_updates_opt_in').eq('id',input.userId).maybeSingle()])
    const email=userResult?.user?.email
    const resendKey=process.env.RESEND_API_KEY;const from=process.env.NOTIFICATION_FROM_EMAIL
    if(email&&resendKey&&from)await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:input.title,text:`${input.body||''}${input.href?`\n\nOpen: ${(process.env.NEXT_PUBLIC_SITE_URL||'https://dropverse.js.org')}${input.href}`:''}`})})
    const waToken=process.env.WHATSAPP_ACCESS_TOKEN;const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID
    if(profile?.whatsapp_updates_opt_in&&profile.phone&&waToken&&phoneId)await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${waToken}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:String(profile.phone).replace(/\D/g,''),type:'text',text:{body:`${input.title}\n${input.body||''}`.slice(0,1000)}})})
  } catch(error){console.error('[externalNotification]',error)}
}
