import type { Metadata } from 'next'
import MarginCalculator from './MarginCalculator'

export const metadata: Metadata = { title: 'Margin Calculator | DropVerse Tools', description: 'Calculate profit and margin from the amounts you enter.' }
export default function MarginCalculatorPage() { return <MarginCalculator /> }
