import type { NextConfig } from 'next'

const cspDirectives = [
  "default-src 'self'",
  // Keep inline scripts for the current Next.js app; avoid unsafe-eval in production.
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://js.spaceremit.com https://*.spaceremit.com https://accounts.google.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://*.paypalobjects.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.vercel.app https://lh3.googleusercontent.com https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://*.spaceremit.com https://api.spaceremit.com https://accounts.google.com https://www.paypal.com https://api-m.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com",
  "frame-src 'self' https://challenges.cloudflare.com https://*.spaceremit.com https://accounts.google.com https://www.google.com https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com",
  "media-src 'self' data: blob: https://*.supabase.co https://*.vercel.app",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://www.paypal.com https://*.paypal.com",
  "report-uri /api/csp-report",
].join('; ')

const enforce = process.env.CSP_ENFORCE === 'true'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
    value: cspDirectives,
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
