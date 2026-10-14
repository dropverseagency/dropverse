export const DODO_API_BASE = process.env.DODO_PAYMENTS_ENV === 'test'
  ? 'https://test.dodopayments.com'
  : 'https://live.dodopayments.com'

export function dodoConfigured() {
  const key = process.env.DODO_PAYMENTS_API_KEY
  return Boolean(key && !key.startsWith('SET_') && !key.startsWith('YOUR_'))
}

export function dodoHeaders() {
  return {
    Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export function dodoProductConfigured(id: string | undefined | null) {
  return Boolean(id && !id.startsWith('SET_') && !id.startsWith('YOUR_'))
}

export function dodoReturnUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://dropverse.js.org'
  return `${base}${path}`
}
