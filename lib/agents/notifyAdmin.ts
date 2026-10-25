/**
 * Admin notification channels for agents. Never throws to callers.
 */

export async function notifyAdminChannels(htmlMessage: string, plainMessage: string): Promise<void> {
  const tasks: Promise<void>[] = []

  const bot = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (bot && chat) {
    tasks.push(
      (async () => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chat,
              text: htmlMessage,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            }),
          })
          if (!res.ok) {
            console.error('[agents notify] telegram status', res.status)
          }
        } catch (e) {
          console.error('[agents notify] telegram failed', e)
        }
      })(),
    )
  }

  const discord = process.env.DISCORD_WEBHOOK_URL
  if (discord) {
    tasks.push(
      (async () => {
        try {
          const res = await fetch(discord, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: plainMessage.slice(0, 1900) }),
          })
          if (!res.ok) {
            console.error('[agents notify] discord status', res.status)
          }
        } catch (e) {
          console.error('[agents notify] discord failed', e)
        }
      })(),
    )
  }

  if (tasks.length === 0) {
    console.info('[agents notify] no channel configured; message:\n', plainMessage)
    return
  }
  await Promise.allSettled(tasks)
}
