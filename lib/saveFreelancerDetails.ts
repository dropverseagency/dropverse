export async function saveFreelancerDetails(_userId: string, displayName: string, niches: string[], otherNiche: string, links: string[]) {
  // The server API authenticates the session and handles tables that do not
  // grant direct client writes, including portfolio links and verification.
  const response = await fetch('/api/freelancers/profile', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, niches, otherNiche, links }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const messages: Record<string, string> = {
      NOT_AUTHENTICATED: 'Please sign in again and retry.',
      FREELANCER_ONLY: 'Choose the freelancer account type before saving your freelancer profile.',
      INVALID_PROFILE: 'Enter your name and choose at least one valid niche.',
      INVALID_PORTFOLIO_LINKS: 'Add between 1 and 5 valid HTTPS portfolio links.',
    }
    throw new Error(messages[result.error] || 'Could not save freelancer details. Please retry.')
  }
}
