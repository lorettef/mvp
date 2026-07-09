import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.PROD
    ? import.meta.env.VITE_API_URL
    : '/api/v1',  // dev: через Vite proxy (same-origin → нет проблем с CORS и куками)
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
  if (response.data && typeof response.data === 'object') {
    response.data = transformKeys(response.data)
  }
  return response
})

// Response interceptor: handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
