import type { MetadataRoute } from 'next'

const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://dropverse10v.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = [
    '/', '/pricing', '/samples', '/leads', '/academy', '/tools', '/earn',
    '/terms', '/privacy', '/refund',
  ]
  const lastModified = new Date()
  return publicPaths.map((path) => ({
    url: new URL(path, site).toString(),
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/leads' || path === '/pricing' ? 0.8 : 0.5,
  }))
}
