import { api } from './client'
import { dashboardFilterParams } from '@/lib/dashboardFilters'
import type { DashboardFilters, PortfolioInsightResponse } from '@/types/api'

export const portfolioInsightsApi = {
  generate: (filters?: DashboardFilters, signal?: AbortSignal): Promise<PortfolioInsightResponse> =>
    api.post('/insights/portfolio', undefined, { params: dashboardFilterParams(filters), signal }).then((res) => res.data),
}
