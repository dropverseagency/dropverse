'use client'

import { useEffect, useState } from 'react'

export default function LeadEarningsPage() {
  const [balance, setBalance] = useState(0)
  const [ledger, setLedger] = useState<{ id: string; event: string; amount: number; created_at: string; note?: string }[]>([])
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/leads/earnings')
    if (res.status === 401) {
      window.location.href = '/login?redirect=/dashboard/leads/earnings'
      return
    }
    const json = await res.json().catch(() => ({}))
    setBalance(Number(json.balance || 0))
    setLedger(json.ledger || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function requestPayout(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const res = await fetch('/api/leads/earnings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount) }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(json.error || 'Request failed')
      return
    }
    setMsg('Payout requested')
    setAmount('')
    await load()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-[#e7edea]">
      <h1 className="text-2xl font-bold text-white">Lead earnings</h1>
      <p className="mt-2 text-3xl font-bold text-[#e4c979]">${balance.toFixed(2)}</p>
      <p className="mt-1 text-xs text-[#8fa29c]">80% of each sale (before payment processor fees). Payouts are manual after admin review.</p>

      <form onSubmit={requestPayout} className="mt-6 flex gap-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-full bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f]">
          Request payout
        </button>
      </form>
      {msg ? <p className="mt-2 text-xs text-[#8fa29c]">{msg}</p> : null}

      <h2 className="mt-10 text-lg font-semibold text-white">Ledger</h2>
      <ul className="mt-3 space-y-2">
        {ledger.map((row) => (
          <li key={row.id} className="flex justify-between rounded-xl border border-white/10 px-3 py-2 text-sm">
            <span className="text-[#8fa29c]">
              {row.event}
              {row.note ? ` · ${row.note}` : ''}
            </span>
            <span className={Number(row.amount) >= 0 ? 'text-[#9fd8a4]' : 'text-red-300'}>
              {Number(row.amount) >= 0 ? '+' : ''}
              {Number(row.amount).toFixed(2)}
            </span>
          </li>
        ))}
        {ledger.length === 0 ? <p className="text-sm text-[#8fa29c]">No movements yet.</p> : null}
      </ul>
    </div>
  )
}
