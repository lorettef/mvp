import axios from 'axios'

/**
 * `meta` value to opt a single useQuery/useMutation call out of the global
 * error toast (typed via the `Register` augmentation in queryClient.ts):
 *
 *   useMutation({ mutationFn, meta: SKIP_GLOBAL_ERROR })
 */
export const SKIP_GLOBAL_ERROR = { skipGlobalError: true } as const

/** True for aborted requests — those are not user-facing failures. */
export function isCancellation(error: unknown): boolean {
  return axios.isCancel(error) || (error as Error | null)?.name === 'CanceledError'
}

/**
 * Extracts a user-facing message from an API error: the backend `detail`
 * field (FastAPI convention), then the error message, then a generic fallback.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim() !== '') return detail
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item: unknown) => {
      if (typeof item === 'string' && item.trim()) return [item.trim()]
      if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string' && item.msg.trim()) return [item.msg.trim()]
      return []
    })
    if (messages.length) return messages.join('; ')
  }
  const message = (error as Error | null)?.message
  if (typeof message === 'string' && message.trim() !== '') return message
  return fallback
}
