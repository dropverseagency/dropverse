import type { MetadataRoute } from 'next'

const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://dropverse10v.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/dashboard', '/api/', '/login', '/forgot-password', '/reset-password', '/onboarding'] },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
