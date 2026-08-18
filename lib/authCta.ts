/**
 * Auth-aware link targets used site-wide.
 *
 * A signed-in user must NEVER be sent to /login. Primary actions for a
 * signed-in visitor ("Start your journey", "Start selling", "Start earning",
 * "Get Started") all resolve to a workspace/dashboard destination instead.
 */
export function ctaFor(signedIn: boolean, guestHref: string): string {
  if (!signedIn) return guestHref
  return guestHref === '/login' ? '/dashboard/create-project' : guestHref
}

export function ctaLabel(signedIn: boolean, label: string, alt: string = 'Create project'): string {
  return signedIn ? alt : label
}
