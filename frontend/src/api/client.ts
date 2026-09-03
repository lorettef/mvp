import axios from 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Per-request opt-out of the snake_case → camelCase response transform.
     * Used for payloads whose keys must stay snake_case (e.g. the slug-keyed
     * `profiles` dict in the catalog response).
     */
    skipTransform?: boolean
  }
}

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Helper: recursive snake_case → camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function transformKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(transformKeys)
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[toCamelCase(key)] = transformKeys(obj[key])
      return acc
    }, {} as Record<string, any>)
  }
  return obj
}

// Response interceptor: deep-transform snake_case → camelCase
api.interceptors.response.use((response) => {
  if (response.data && typeof response.data === 'object' && !response.config.skipTransform) {
    response.data = transformKeys(response.data)
  }
  return response
})

// Auth-эндпоинты НИКОГДА не должны вызывать очистку сессии/редирект:
// например, неверный пароль (401 от /auth/login) обрабатывается самой
// формой входа и должен оставить inline-ошибку на месте.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/seed', '/auth/logout', '/auth/me']

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  const path = url.split('?')[0]
  return AUTH_ENDPOINTS.some((endpoint) => path === endpoint || path.endsWith(endpoint))
}

// Слот для обработчика 401. Регистрируется из authSession (clearSession):
// client.ts НЕ импортирует authSession — иначе был бы циклический импорт.
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn
}

/** Только для тестов: снимает зарегистрированный обработчик 401. */
export function resetUnauthorizedHandler(): void {
  unauthorizedHandler = null
}

// Response interceptor: 401 → очистка сессии. После регистрации обработчика
// (authSession) hard-redirect НЕ используется: сброс store триггерит мягкий
// <Navigate to="/login"> в ProtectedRoute.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    const err = error as { response?: { status?: number }; config?: { url?: string } }
    if (err.response?.status === 401) {
      // Логин/регистрация/bootstrap сами обрабатывают свой 401.
      if (isAuthEndpoint(err.config?.url)) return Promise.reject(error)
      if (unauthorizedHandler) {
        unauthorizedHandler()
      } else {
        // Фолбэк до регистрации обработчика: полная перезагрузка на /login.
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
