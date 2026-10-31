'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Wallet,
  AlertCircle,
  Landmark,
  Mail,
} from 'lucide-react'
import { useAuth } from '../../../lib/useAuth'
import {
  DROPVERSE_PAYOUT_FEE_USD,
  estimateNetUsd,
  formatUsd,
  type PayoutMethodId,
} from '../../../lib/payoutConfig'
import { ReceiptCard } from '../../../components/ui/ReceiptCard'

// NOTE: full file restored in follow-up if truncated
export default function PayoutsPage() {
  return <div className="p-6 text-sm text-[#81948e]">Payouts page is being restored…</div>
}
