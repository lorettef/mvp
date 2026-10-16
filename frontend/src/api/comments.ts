import { api } from './client'
import type { CommentTargetType, ReviewComment, ReviewCommentCreate } from '@/types/api'

export const commentsApi = {
  list: (companyId: string, targetType: CommentTargetType, signal?: AbortSignal): Promise<ReviewComment[]> =>
    api.get(`/companies/${companyId}/comments`, { params: { target_type: targetType }, signal }).then(response => response.data),
  create: (companyId: string, data: ReviewCommentCreate): Promise<ReviewComment> =>
    api.post(`/companies/${companyId}/comments`, data).then(response => response.data),
}
