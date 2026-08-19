import type {
  Company,
  CompanyCreate,
  CompanyUpdate,
  Metric,
  MetricUpsert,
  DashboardResponse,
  Cohort,
  CohortUpsert,
  Budget,
  BudgetUpsert,
} from '@/types/api'
import { api } from './client'

export const companiesApi = {
  list: (): Promise<Company[]> => api.get('/companies').then((res) => res.data),
  get: (id: string): Promise<Company> => api.get(`/companies/${id}`).then((res) => res.data),
  create: (data: CompanyCreate): Promise<Company> =>
    api.post('/companies', data).then((res) => res.data),
  update: (id: string, data: CompanyUpdate): Promise<Company> =>
    api.patch(`/companies/${id}`, data).then((res) => res.data),
  remove: (id: string): Promise<void> =>
    api.delete(`/companies/${id}`).then((res) => res.data),
  metrics: (id: string, period?: string): Promise<Metric[]> =>
    api.get(`/companies/${id}/metrics`, { params: period ? { period } : {} }).then((res) => res.data),
  upsertMetric: (id: string, data: MetricUpsert): Promise<Metric> =>
    api.put(`/companies/${id}/metrics`, data).then((res) => res.data),
  cohorts: (id: string, period?: string): Promise<Cohort[]> =>
    api.get(`/companies/${id}/cohorts`, { params: period ? { period } : {} }).then((res) => res.data),
  upsertCohort: (id: string, data: CohortUpsert): Promise<Cohort> =>
    api.put(`/companies/${id}/cohorts`, data).then((res) => res.data),
  budgets: (id: string, period?: string): Promise<Budget[]> =>
    api.get(`/companies/${id}/budgets`, { params: period ? { period } : {} }).then((res) => res.data),
  upsertBudget: (id: string, data: BudgetUpsert): Promise<Budget> =>
    api.put(`/companies/${id}/budgets`, data).then((res) => res.data),
}

export const dashboardApi = {
  get: (): Promise<DashboardResponse> => api.get('/dashboard').then((res) => res.data),
}
