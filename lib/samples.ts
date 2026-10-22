export const SAMPLE_CATEGORIES = [
  'Video Editing',
  'Graphic Design',
  'Web Design',
  'Social Media Content',
  'UGC Content',
  'Copywriting',
  'Branding',
  'Motion Graphics',
] as const

export const SAMPLE_ORIGINAL_BUCKET = 'sample-originals'
export const SAMPLE_COVER_BUCKET = 'sample-covers'
export const SAMPLE_MAX_FILE_BYTES = 50 * 1024 * 1024
export const SAMPLE_MAX_FILES = 10
export const SAMPLE_RIGHTS_TERMS_VERSION = '2026-10-23'

export function isFreelancerProfile(profile: {
  user_type?: string | null
  user_types?: string[] | null
} | null | undefined): boolean {
  return Boolean(
    profile &&
      (profile.user_type === 'freelancer' ||
        (Array.isArray(profile.user_types) && profile.user_types.includes('freelancer'))),
  )
}

export function sampleFileKind(mime: string): 'image' | 'pdf' | 'video' | null {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (['video/mp4', 'video/quicktime'].includes(mime)) return 'video'
  return null
}

export function safeSampleFilename(name: string): string {
  return (name || 'sample-file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
}

export function slugifySample(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
  return base || 'sample'
}
