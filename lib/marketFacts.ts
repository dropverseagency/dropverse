/** Verified 2026 market context. Figures are category estimates, not DropVerse revenue. */

export type MarketFact = {
  id: string
  title: string
  body: string
  figure?: string
  figureLabel?: string
  scope: string
  sourceName: string
  sourceUrl: string
  sourceDate: string
  href: string
  cta: string
}

export const MARKET_FACTS: MarketFact[] = [
  {
    id: 'services',
    title: 'Digital services',
    body: 'Pitch proven samples and deliver work from a shared workspace — video, design, web, and the other services DropVerse actually lists.',
    figure: '$6.37B (2025) · $7.3B (2026)',
    figureLabel: 'Freelance platforms — separate years, not a sum',
    scope:
      'Grand View Research valued the global freelance-platforms market at $6.37 billion in 2025 (about $6.4 billion when the June 2026 page rounds it) and projects $7.3 billion in 2026, toward $24.2 billion by 2033. These are two points on one forecast, not amounts to add. The category is platforms that connect clients and independent workers — not the market for video editing or design, and not DropVerse revenue.',
    sourceName: 'Grand View Research',
    sourceUrl: 'https://www.grandviewresearch.com/industry-analysis/freelance-platforms-market-report',
    sourceDate: '2025 base in the Feb 2026 publication; 2026 figure on the report page, updated June 2026',
    href: '/#services',
    cta: 'See services',
  },
  {
    id: 'leads',
    title: 'Lead generation',
    body: 'Browse seller-submitted lead packs by niche and country. A pack is a file the seller listed — not a promise that every row is a qualified sales lead.',
    figure: '$5.63B',
    figureLabel: 'Lead-generation services, 2026',
    scope:
      'PW Consulting’s June 2026 update projects the worldwide lead-generation services market at $5.63 billion in 2026 (about $4.81 billion in 2025). That covers inbound and outbound lead-generation services, not downloadable spreadsheets and not DropVerse sales.',
    sourceName: 'PW Consulting',
    sourceUrl: 'https://pmarketresearch.com/worldwide-lead-generation-services-market-research/',
    sourceDate: 'Updated 18 Jun 2026',
    href: '/leads',
    cta: 'Open marketplace',
  },
  {
    id: 'digital',
    title: 'Digital products',
    body: 'Use work samples and workspace assets you can actually open today. DropVerse does not run a separate digital-goods checkout.',
    figure: '$157.39B',
    figureLabel: 'Digital goods market, 2026 estimate',
    scope:
      'Mordor Intelligence estimates this market at $124.32 billion in 2025 and $157.39 billion in 2026 (to $511.43 billion by 2031). The definition covers e-books, digital music and podcasts, video and streaming, online games and virtual goods, plus other digital content such as stock and templates. It is not DropVerse revenue and not the value of files sold here.',
    sourceName: 'Mordor Intelligence',
    sourceUrl: 'https://www.mordorintelligence.com/industry-reports/digital-goods-market',
    sourceDate: 'Report page states the 2026 figure; forecast window 2026–2031',
    href: '/samples',
    cta: 'Browse samples',
  },
  {
    id: 'commerce',
    title: 'E-commerce',
    body: 'Explore online-business context while you sell services. This figure is global B2C online retail of physical goods — not a DropVerse store.',
    figure: '$3.89T',
    figureLabel: 'B2C e-commerce, 2026 projection',
    scope:
      'Statista Market Insights projects worldwide e-commerce revenue at US$3.89 trillion in 2026. Definition: physical goods sold online to private end consumers (B2C). It excludes digital media and is not a B2B total.',
    sourceName: 'Statista Market Insights',
    sourceUrl: 'https://www.statista.com/outlook/emo/ecommerce/worldwide/',
    sourceDate: 'Most recent update Oct 2026',
    href: '/pricing',
    cta: 'Compare plans',
  },
]
