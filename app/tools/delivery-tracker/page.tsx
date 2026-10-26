import type { Metadata } from 'next'
import DeliveryTracker from './DeliveryTracker'

export const metadata: Metadata = { title: 'Delivery Tracker | DropVerse Tools', description: 'Track job status and due dates on your device.' }
export default function DeliveryTrackerPage() { return <DeliveryTracker /> }
