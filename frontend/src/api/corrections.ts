import { api } from './client'
import type { CorrectionTargetType, ReviewCorrection, ReviewCorrectionCreate } from '@/types/api'

export const correctionsApi = {
  list: (companyId: string, targetType: CorrectionTargetType, signal?: AbortSignal): Promise<ReviewCorrection[]> =>
    api.get(`/companies/${companyId}/corrections`, { params: { target_type: targetType }, signal }).then(response => response.data),
  create: (companyId: string, data: ReviewCorrectionCreate): Promise<ReviewCorrection> =>
    api.post(`/companies/${companyId}/corrections`, data).then(response => response.data),
}
