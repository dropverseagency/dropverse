import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'DropVerse — Linking Talent to Sales', template: '%s | DropVerse' },
  description: 'Access professional service samples, discover talented freelancers, and build your Drop Servicing business with DropVerse.',
  keywords: ['drop servicing', 'freelancers', 'video editing', 'graphic design', 'web design', 'UGC content', 'copywriting'],
  authors: [{ name: 'DropVerse' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'DropVerse — Linking Talent to Sales',
    description: 'Access professional service samples, discover talented freelancers, and build your Drop Servicing business with DropVerse.',
    siteName: 'DropVerse',
  },
  twitter: { card: 'summary_large_image', title: 'DropVerse — Linking Talent to Sales', description: 'Access professional service samples, discover talented freelancers, and build your Drop Servicing business.' },
  robots: { index: true, follow: true },
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#071f1d' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
