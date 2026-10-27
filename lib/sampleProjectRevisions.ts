export type SampleRevisionRow = {
  status: string
  revision_limit: number
  revision_price_usd: number
}

export function projectRevisionColumns(
  sampleId: string,
  sample: SampleRevisionRow | null,
):
  | { ok: true; columns: { revision_limit?: number; revision_price_usd: number | null } }
  | { ok: false; error: 'SAMPLE_NOT_AVAILABLE' } {
  if (!sampleId) return { ok: true, columns: { revision_price_usd: null } }
  if (!sample || sample.status !== 'approved') return { ok: false, error: 'SAMPLE_NOT_AVAILABLE' }
  return {
    ok: true,
    columns: {
      revision_limit: Number(sample.revision_limit),
      revision_price_usd: Number(sample.revision_price_usd),
    },
  }
}
