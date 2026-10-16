import type { User } from '@/store/authStore'

/** An unavailable product role has no authenticated entry route. */
export function getDefaultRoute(user: Pick<User, 'productRole' | 'organizationId' | 'companyId'> | null | undefined): string | null {
  if (!user?.organizationId) return null
  if (user.productRole === 'fund' || user.productRole === 'investor') return '/dashboard'
  if (user.productRole === 'startup') {
    return user.companyId ? `/companies/${user.companyId}` : '/dashboard'
  }
  return null
}
