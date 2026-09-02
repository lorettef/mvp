import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage, isCancellation } from './toastError'

// Type the `meta` field of useQuery/useMutation options so the opt-out marker
// gets compile-time checking (TanStack Query v5 `Register` convention).
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { skipGlobalError?: boolean }
    mutationMeta: { skipGlobalError?: boolean }
  }
}

/**
 * QueryClient wired with global error handlers: every query/mutation failure
 * that is not handled locally surfaces as an error toast.
 *
 * Opt out per call with `meta: SKIP_GLOBAL_ERROR` (see toastError.ts);
 * cancelled requests never toast. Local `onError` handlers still run — the
 * global handler fires before them and does not swallow anything.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.skipGlobalError || isCancellation(error)) return
        toast.error(getErrorMessage(error))
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.skipGlobalError || isCancellation(error)) return
        toast.error(getErrorMessage(error))
      },
    }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 5 * 60 * 1000,
      },
    },
  })
}
