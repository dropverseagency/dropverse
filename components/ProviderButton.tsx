export default function ProviderButton({
  provider,
  label,
  logo,
  onClick,
  loading,
}: {
  provider: string
  label: string
  logo: React.ReactNode
  onClick: () => void
  loading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={`Continue with ${label}`}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <svg className="h-5 w-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        logo
      )}
      <span>
        {loading ? `Connecting ${label}...` : `Continue with ${label}`}
      </span>
    </button>
  )
}
