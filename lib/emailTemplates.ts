const DEFAULT_SITE_URL = 'https://dropverse10v.vercel.app'

export type WelcomeEmail = {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function resolveSiteUrl(value?: string): string {
  try {
    const parsed = new URL((value || DEFAULT_SITE_URL).trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return DEFAULT_SITE_URL
    return parsed.origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

/** Builds the welcome email without sending it; safe to use in previews and tests. */
export function buildWelcomeEmail(siteUrl?: string): WelcomeEmail {
  const url = resolveSiteUrl(siteUrl)
  const safeUrl = escapeHtml(url)

  const text = [
    'Welcome to DropVerse!',
    '',
    'Your account is ready. Explore the platform, manage projects, and find services that fit your goals.',
    '',
    'Open DropVerse: ' + url,
    '',
    '— The DropVerse Team',
  ].join('\\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Welcome to DropVerse</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6f5;font-family:Arial,Helvetica,sans-serif;color:#173b3a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your DropVerse account is ready. Let’s get started.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f3f6f5;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;background-color:#073b3a;border-bottom:4px solid #d7b65b;">
              <p style="margin:0;font-size:12px;letter-spacing:2px;font-weight:700;color:#e7cf86;text-transform:uppercase;">DropVerse</p>
              <h1 style="margin:12px 0 0;font-size:28px;line-height:1.25;font-weight:700;color:#ffffff;">Welcome aboard.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#173b3a;">Your account is ready.</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#526766;">Explore the platform, manage projects, and find services that fit your goals. We’re glad you’re here.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
                <tr>
                  <td align="center" bgcolor="#d7b65b" style="border-radius:8px;">
                    <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 22px;border-radius:8px;background-color:#d7b65b;color:#073b3a;text-decoration:none;font-size:15px;font-weight:700;">Open DropVerse</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#718381;">If the button doesn’t work, copy this link into your browser:<br><a href="${safeUrl}" style="color:#0b6661;text-decoration:underline;word-break:break-all;">${safeUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f7f8f5;border-top:1px solid #e8ece8;">
              <p style="margin:0;font-size:12px;line-height:1.7;color:#6f7d79;">You’re receiving this email because a DropVerse account was created with this address.</p>
              <p style="margin:8px 0 0;font-size:12px;color:#526766;">— The DropVerse Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: 'Welcome to DropVerse', text, html }
}
