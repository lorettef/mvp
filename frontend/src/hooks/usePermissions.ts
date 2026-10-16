import { useAuthStore } from '@/store/authStore'
import { getPermissions } from '@/lib/permissions'

export function usePermissions() {
  const { user, sessionReady } = useAuthStore()
  return getPermissions(sessionReady === false ? null : user)
}
