import { adminClient } from '@/lib/adminCore'
import { sendGmailNotificationEmail } from '@/lib/gmailSmtp'

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
 * Best-effort in-app notification plus an email to the affected user.
 * Supabase Auth emails (confirmation, password reset, etc.) are not handled here.
 * Email delivery is independent of whether the in-app notification table is available.
 */
export async function createUserNotification(input: UserNotificationInput): Promise<void> {
  try {
    if (!input.userId || !input.type || !input.title) return

    try {
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
      if (error && !/does not exist|relation|permission/i.test(error.message || '')) {
        console.error('[userNotifications] in-app insert failed:', error.message)
      }
    } catch (error) {
      console.error('[userNotifications] in-app insert failed:', error)
    }

    await sendExternalNotification(input)
  } catch (error) {
    console.error('[userNotifications]', error)
  }
}

async function sendExternalNotification(input: UserNotificationInput): Promise<void> {
  try {
    const admin = adminClient()
    const { data, error } = await admin.auth.admin.getUserById(input.userId)
    if (error) {
      console.error('[userNotifications] could not resolve recipient email:', error.message)
      return
    }

    const email = data.user?.email
    if (!email) return

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://dropverse10v.vercel.app').replace(/\/$/, '')
    const link = input.href ? `\n\nOpen: ${siteUrl}${input.href.startsWith('/') ? input.href : `/${input.href}`}` : ''
    const text = `${input.body || ''}${link}\n\n— DropVerse`

    await sendGmailNotificationEmail(email, input.title, text)
  } catch (error) {
    console.error('[userNotifications] email notification failed:', error)
  }
}
