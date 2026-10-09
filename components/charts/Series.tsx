'use client'

export function RangeTabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ranges = [
    { id: '7', label: '7 days' },
    { id: '30', label: '30 days' },
    { id: '90', label: '90 days' },
    { id: '365', label: 'Year' },
  ]
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Date range">
      {ranges.map((range) => (
        <button
          key={range.id}
          onClick={() => onChange(range.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            value === range.id
              ? 'bg-[#d8b45a] text-[#10221f]'
              : 'border border-white/10 text-[#c7d3ce] hover:border-[rgba(216,180,90,0.45)]'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}

export function SeriesChart({ points, color = '#d8b45a' }: { points: { label: string; value: number }[]; color?: string }) {
  const width = 640
  const height = 190
  const pad = 18
  const values = points.map((p) => p.value)
  const max = Math.max(1, ...values)
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0
  const coords = points.map((point, i) => {
    const x = pad + i * step
    const y = height - pad - (point.value / max) * (height - pad * 2)
    return { x, y, ...point }
  })
  const line = coords.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  const area = `${line} L${width - pad},${height - pad} L${pad},${height - pad} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img">
      {[0, 0.5, 1].map((n) => (
        <line key={n} x1={pad} x2={width - pad} y1={pad + n * (height - pad * 2)} y2={pad + n * (height - pad * 2)} stroke="rgba(255,255,255,0.08)" />
      ))}
      <path d={area} fill={color} opacity="0.16" />
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((p) => <circle key={p.label} cx={p.x} cy={p.y} r="3.5" fill="#0c1916" stroke={color} strokeWidth="2" />)}
    </svg>
  )
}
