import axios from 'axios'
import { getErrorMessage } from './toastError'

interface FastApiValidationItem { loc?: Array<string | number>; msg?: string; type?: string }
export interface NormalizedApiError { field?: string; message: string }

const tailOf = (loc: unknown): string | null => {
  if (!Array.isArray(loc) || loc.length === 0) return null
  const last = loc[loc.length - 1]
  return typeof last === 'string' ? last : null
}
const isGreaterThanZero = (item: FastApiValidationItem): boolean => Boolean(item.type && /greater_than/.test(item.type)) || Boolean(item.msg && /greater than|> 0/i.test(item.msg))

/** Existing cross-product normalizer for common financial validation errors. */
export function normalizeApiError(error: unknown): NormalizedApiError {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (Array.isArray(detail)) {
    for (const raw of detail) {
      const item = (raw ?? {}) as FastApiValidationItem
      const field = tailOf(item.loc)
      if (field === 'arpu' && isGreaterThanZero(item)) return { field, message: 'ARPU должен быть больше 0' }
      if (field === 'retention_rate' || (field != null && /^retention_m\d+$/.test(field))) return { field, message: 'Retention должен быть от 0 до 1' }
      if (field === 'title') return { field, message: 'Название должно быть не длиннее 200 символов' }
    }
    const firstMsg = (detail[0] as FastApiValidationItem | undefined)?.msg
    if (typeof firstMsg === 'string' && firstMsg.trim() !== '') return { message: firstMsg.replace(/^Value error,\s*/i, '') }
  }
  return { message: getErrorMessage(error) }
}

export type ApiField = 'email' | 'password' | 'confirmPassword' | 'fullName' | 'companyName'
export interface NormalizedFormApiError {
  status?: number
  message: string
  fieldErrors: Partial<Record<ApiField, string>>
  retryAfter?: string
  network: boolean
}
const formFieldMap: Record<string, ApiField | undefined> = { email: 'email', password: 'password', full_name: 'fullName', company_name: 'companyName' }

/** Registration-aware extension: retains status, headers and every field error. */
export function normalizeFormApiError(error: unknown, fallback: string): NormalizedFormApiError {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown }; headers?: Record<string, unknown> } })?.response
  const result: NormalizedFormApiError = { status: response?.status, message: fallback, fieldErrors: {}, network: axios.isAxiosError(error) && !response }
  const retryAfter = response?.headers?.['retry-after']
  if (typeof retryAfter === 'string' || typeof retryAfter === 'number') result.retryAfter = String(retryAfter)
  const detail = response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) { result.message = detail.trim(); return result }
  if (Array.isArray(detail)) {
    const general: string[] = []
    for (const raw of detail) {
      const item = (raw ?? {}) as FastApiValidationItem
      if (typeof item.msg !== 'string' || !item.msg.trim()) continue
      const field = formFieldMap[tailOf(item.loc) ?? '']
      if (field) result.fieldErrors[field] ??= item.msg.replace(/^Value error,\s*/i, '').trim()
      else general.push(item.msg.trim())
    }
    const messages = [...Object.values(result.fieldErrors), ...general]
    if (messages.length) result.message = messages.join('; ')
  }
  return result
}
