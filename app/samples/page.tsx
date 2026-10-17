import { redirect } from 'next/navigation'

/** Samples vault entry — scrolls to work library on the landing page. */
export default function SamplesPage() {
  redirect('/#samples')
}
