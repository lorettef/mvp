import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { correctionsApi } from '@/api/corrections'
import { getTenantKey } from '@/auth/authSession'
import { qk } from '@/lib/queryKeys'
import type { CorrectionTargetType, ReviewCorrectionCreate } from '@/types/api'

export function useCompanyCorrections(companyId: string, targetType: CorrectionTargetType, enabled: boolean) {
  const tenant = getTenantKey()
  const queryClient = useQueryClient()
  const queryKey = qk.companyCorrections(tenant, companyId, targetType)
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => correctionsApi.list(companyId, targetType, signal),
    enabled: enabled && Boolean(companyId),
  })
  const mutation = useMutation({
    mutationFn: (data: ReviewCorrectionCreate) => correctionsApi.create(companyId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
  return { query, mutation }
}
