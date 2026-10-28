import type { Metadata } from 'next'
import './globals.css'
import './direction-two.css'
import Motion from '../components/Motion'
import VisitBeacon from '../components/VisitBeacon'

export const metadata: Metadata = {
  metadataBase: new URL('https://dropverse10v.vercel.app'),
  alternates: { canonical: '/' },
  title: { default: 'DropVerse — Build your online business & agency', template: '%s | DropVerse' },
  description: 'Build your online business and agency with DropVerse: digital services, work samples, project workspaces, and a lead marketplace. Not a guarantee of income or clients.',
  keywords: ['B2B SaaS', 'workspace management', 'project management', 'workflow automation', 'team collaboration', 'client operations', 'digital asset management', 'DropVerse'],
  authors: [{ name: 'DropVerse' }],
  icons: { icon: '/dropverse-logo.jpeg', apple: '/dropverse-logo.jpeg' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'DropVerse — Build your online business & agency',
    description: 'Sell digital services, pitch samples, run projects, and trade lead packs in one workspace.',
    siteName: 'DropVerse',
    url: 'https://dropverse10v.vercel.app',
    images: [{ url: '/dropverse-logo.jpeg', width: 500, height: 500, alt: 'DropVerse logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropVerse — Build your online business & agency',
    description: 'Sell digital services, pitch samples, run projects, and trade lead packs in one workspace.',
  },
  robots: { index: true, follow: true },
  other: { 'spaceremit-verification': 'JKERE77DSSYUMQPYU3FC9789U9H87T5DG5UUHBAPMBI574V800' },
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#061916' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="direction-two-theme"><Motion /><VisitBeacon />{children}</body></html>
}
