export function MarketCite({
  sourceName,
  sourceUrl,
  sourceDate,
  scope,
}: {
  sourceName: string
  sourceUrl: string
  sourceDate: string
  scope: string
}) {
  return (
    <p className="mt-3 text-[11px] leading-5 text-[#7f918c]">
      <a href={sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#cbb56a] underline-offset-2 hover:underline">
        {sourceName}
      </a>
      <span> · {sourceDate}. </span>
      <span>{scope}</span>
    </p>
  )
}
