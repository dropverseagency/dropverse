import type { Metadata } from 'next'
import './globals.css'
import Motion from '../components/Motion'
import VisitBeacon from '../components/VisitBeacon'

export const metadata: Metadata = {
  metadataBase: new URL('https://dropverse.js.org'),
  title: { default: 'DropVerse — B2B Project & Workspace Management', template: '%s | DropVerse' },
  description: 'Access automated digital workflow tools, client management templates, and collaborative workspaces.',
  keywords: ['B2B SaaS', 'workspace management', 'project management', 'workflow automation', 'team collaboration', 'client operations', 'digital asset management'],
  authors: [{ name: 'DropVerse' }],
  icons: { icon: '/dropverse-logo.jpeg', apple: '/dropverse-logo.jpeg' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'DropVerse — B2B Project & Workspace Management',
    description: 'Access automated digital workflow tools, client management templates, and collaborative workspaces.',
    siteName: 'DropVerse',
    images: [{ url: '/dropverse-logo.jpeg', width: 500, height: 500, alt: 'DropVerse logo' }],
  },
  twitter: { card: 'summary_large_image', title: 'DropVerse — B2B Project & Workspace Management', description: 'Access automated digital workflow tools, client management templates, and collaborative workspaces.' },
  robots: { index: true, follow: true },
  other: { 'spaceremit-verification': 'JKERE77DSSYUMQPYU3FC9789U9H87T5DG5UUHBAPMBI574V800' },
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#061916' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Motion /><VisitBeacon />{children}</body></html>
}
