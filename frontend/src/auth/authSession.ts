import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore, type User } from '../store/authStore'
import { authApi } from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import type { UserResponse } from '../types/api'

// Единая точка управления auth-сессией:
// кэш React Query очищается СИНХРОННО на каждой смене пользователя,
// чтобы данные организации A никогда не достались организации B.
let queryClientRef: QueryClient | null = null

export function clearSession(): void {
  // Синхронная полная очистка: кэш + store + persisted storage.
  if (queryClientRef) {
    queryClientRef.clear()
  }
  useAuthStore.getState().setUser(null)
  useAuthStore.persist.clearStorage()
}

export function registerQueryClient(qc: QueryClient): void {
  queryClientRef = qc
  // 401 на data-эндпоинте → clearSession() (мягкий редирект через ProtectedRoute).
  setUnauthorizedHandler(clearSession)
}

export function getTenantKey(): string {
  const user = useAuthStore.getState().user
  if (!user) return ''
  return user.organizationId ?? user.id
}

function mapUser(userData: UserResponse): User {
  return {
    id: userData.id,
    email: userData.email,
    fullName: userData.fullName ?? '',
    companyName: userData.companyName ?? '',
    role: userData.role,
    organizationId: userData.organizationId,
    companyId: userData.companyId,
    subscriptionPlan: userData.subscriptionPlan,
    dailyLimit: userData.dailyLimit,
    usedToday: userData.usedToday,
    organizationType: userData.organizationType ?? null,
  }
}

export function completeLogin(userData: UserResponse): void {
  // clear() сбрасывает и QueryCache, и MutationCache.
  // Очистка ДО setUser — в том же синхронном вызове.
  if (queryClientRef) {
    queryClientRef.clear()
  }
  useAuthStore.getState().setUser(mapUser(userData))
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout()
  } catch (error) {
    const response = (error as { response?: { status?: number } })?.response
    if (response && response.status !== 401) {
      toast.warning('Не удалось завершить сессию на сервере')
    }
    // Сеть недоступна (нет response) или 401 — молча: локально всё равно чистим.
  }
  clearSession()
}

// Флаг «bootstrap уже запускался». React 18 StrictMode в dev дважды
// инвоук-ит эффекты, поэтому флаг ставится СИНХРОННО до первого await —
// сетевой вызов me() выполняется максимум один раз за жизнь модуля.
let bootstrapped = false

export function resetBootstrap(): void {
  // Только для тестов: сбрасывает single-flight флаг, чтобы каждый
  // тест мог прогнать bootstrap() заново.
  bootstrapped = false
}

export async function bootstrap(): Promise<void> {
  // КРИТИЧЕСКИЙ guard: без persisted user не идём в сеть вообще.
  // me() без сессии вернул бы 401 → интерсептор делает hard-redirect
  // → reload → bootstrap снова → бесконечный цикл.
  if (useAuthStore.getState().user == null) return

  if (bootstrapped) return
  bootstrapped = true

  try {
    // Сверяем stale persisted user с сервером до рендера защищённых роутов.
    const userData = await authApi.me()
    useAuthStore.getState().setUser(mapUser(userData))
  } catch {
    // 401 или сеть: сессия невалидна — полный локальный logout
    // (store + query cache + persisted storage).
    await logout()
  }
}
