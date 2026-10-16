import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commentsApi } from '@/api/comments'
import { getTenantKey } from '@/auth/authSession'
import { qk } from '@/lib/queryKeys'
import type { CommentTargetType, ReviewCommentCreate } from '@/types/api'

export function useCompanyComments(companyId: string, targetType: CommentTargetType, enabled: boolean) {
  const tenant = getTenantKey()
  const queryClient = useQueryClient()
  const queryKey = qk.companyComments(tenant, companyId, targetType)
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => commentsApi.list(companyId, targetType, signal),
    enabled: enabled && Boolean(companyId),
  })
  const mutation = useMutation({
    mutationFn: (data: ReviewCommentCreate) => commentsApi.create(companyId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
  return { query, mutation }
}
