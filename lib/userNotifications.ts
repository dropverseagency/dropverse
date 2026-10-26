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
  } catch (e) {
    console.error('[userNotifications]', e)
  }
}
