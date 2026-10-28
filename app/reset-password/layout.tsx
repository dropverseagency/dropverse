import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Securely update your DropVerse account password.',
  robots: { index: false, follow: false },
}

export default function ResetPasswordLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
