import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a secure password reset link for your DropVerse account.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
