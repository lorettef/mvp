import { getErrorMessage } from './toastError'

/** One entry of a FastAPI 422 validation error (`detail` is an ARRAY of these). */
interface FastApiValidationItem {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

export interface NormalizedApiError {
  /** The offending field name when it could be mapped (last `loc` element). */
  field?: string
  /** Actionable, user-facing message. */
  message: string
}

const tailOf = (loc: unknown): string | null => {
  if (!Array.isArray(loc) || loc.length === 0) return null
  const last = loc[loc.length - 1]
  return typeof last === 'string' ? last : null
}

/** True for `gt: 0`-style pydantic constraints (`greater_than`/`greater_than_equal`). */
const isGreaterThanZero = (item: FastApiValidationItem): boolean =>
  Boolean(item.type && /greater_than/.test(item.type)) ||
  Boolean(item.msg && /greater than|> 0/i.test(item.msg))

/**
 * Best-effort mapper of backend 422 validation errors into actionable field
 * messages. Unknown fields fall back to the first validation message or to
 * getErrorMessage(error) for non-422 errors.
 */
export function normalizeApiError(error: unknown): NormalizedApiError {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail

  if (Array.isArray(detail)) {
    for (const raw of detail) {
      const item = (raw ?? {}) as FastApiValidationItem
      const field = tailOf(item.loc)
      if (field === 'arpu' && isGreaterThanZero(item)) {
        return { field, message: 'ARPU должен быть больше 0' }
      }
      if (field === 'retention_rate' || (field != null && /^retention_m\d+$/.test(field))) {
        return { field, message: 'Retention должен быть от 0 до 1' }
      }
      if (field === 'title') {
        return { field, message: 'Название должно быть не длиннее 200 символов' }
      }
    }
    // No rule matched — surface the first validation message when available.
    const firstMsg = (detail[0] as FastApiValidationItem | undefined)?.msg
    if (typeof firstMsg === 'string' && firstMsg.trim() !== '') {
      return { message: firstMsg.replace(/^Value error,\s*/i, '') }
    }
  }

  return { message: getErrorMessage(error) }
}
