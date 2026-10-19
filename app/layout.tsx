import type { Metadata } from 'next'
import './globals.css'
import Motion from '../components/Motion'
import VisitBeacon from '../components/VisitBeacon'

export const metadata: Metadata = {
  metadataBase: new URL('https://dropverse.js.org'),
  title: { default: 'DropVerse — Digital services, lead packs, and workspaces', template: '%s | DropVerse' },
  description: 'Explore digital services, lead packs, and work samples on DropVerse. A workspace for teams that sell and deliver — not a guarantee of income.',
  keywords: ['B2B SaaS', 'workspace management', 'project management', 'workflow automation', 'team collaboration', 'client operations', 'digital asset management', 'DropVerse'],
  authors: [{ name: 'DropVerse' }],
  icons: { icon: '/dropverse-logo.jpeg', apple: '/dropverse-logo.jpeg' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'DropVerse — Digital services, lead packs, and workspaces',
    description: 'Explore digital services, lead packs, and work samples on DropVerse.',
    siteName: 'DropVerse',
    images: [{ url: '/dropverse-logo.jpeg', width: 500, height: 500, alt: 'DropVerse logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropVerse — Digital services, lead packs, and workspaces',
    description: 'Explore digital services, lead packs, and work samples on DropVerse.',
  },
  robots: { index: true, follow: true },
  other: { 'spaceremit-verification': 'JKERE77DSSYUMQPYU3FC9789U9H87T5DG5UUHBAPMBI574V800' },
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#061916' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Motion /><VisitBeacon />{children}</body></html>
}
