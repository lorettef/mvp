import type {
  Company,
  CompanyCreate,
  CompanyUpdate,
  Metric,
  MetricUpsert,
  MetricBulkUpsert,
  DashboardResponse,
  Cohort,
  CohortUpsert,
  Budget,
  BudgetUpsert,
  UnitEconomicsResponse,
  Task,
  TaskCreate,
  TaskUpdate,
  ReadinessResponse,
  RecalculateResponse,
  PlanGenerateResponse,
  InsightScenario,
  InsightResponse,
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
  upsertMetricBulk: (id: string, data: MetricBulkUpsert): Promise<Metric[]> =>
    api.put(`/companies/${id}/metrics/bulk`, data).then((res) => res.data),
  cohorts: (id: string, period?: string): Promise<Cohort[]> =>
    api.get(`/companies/${id}/cohorts`, { params: period ? { period } : {} }).then((res) => res.data),
  upsertCohort: (id: string, data: CohortUpsert): Promise<Cohort> =>
    api.put(`/companies/${id}/cohorts`, data).then((res) => res.data),
  budgets: (id: string, period?: string): Promise<Budget[]> =>
    api.get(`/companies/${id}/budgets`, { params: period ? { period } : {} }).then((res) => res.data),
  upsertBudget: (id: string, data: BudgetUpsert): Promise<Budget> =>
    api.put(`/companies/${id}/budgets`, data).then((res) => res.data),
  unitEconomics: (id: string): Promise<UnitEconomicsResponse> =>
    api.get(`/companies/${id}/unit-economics`).then((res) => res.data),
  tasks: (id: string): Promise<Task[]> =>
    api.get(`/companies/${id}/tasks`).then((res) => res.data),
  createTask: (id: string, data: TaskCreate): Promise<Task> =>
    api.post(`/companies/${id}/tasks`, data).then((res) => res.data),
  updateTask: (id: string, taskId: string, data: TaskUpdate): Promise<Task> =>
    api.patch(`/companies/${id}/tasks/${taskId}`, data).then((res) => res.data),
  deleteTask: (id: string, taskId: string): Promise<void> =>
    api.delete(`/companies/${id}/tasks/${taskId}`).then((res) => res.data),
  readiness: (id: string): Promise<ReadinessResponse> =>
    api.get(`/companies/${id}/readiness`).then((res) => res.data),
  recalculate: (id: string): Promise<RecalculateResponse> =>
    api.post(`/companies/${id}/recalculate`).then((res) => res.data),
  generatePlan: (id: string, months = 6): Promise<PlanGenerateResponse> =>
    api.post(`/companies/${id}/generate-plan`, null, { params: { months } }).then((res) => res.data),
  insight: (id: string, scenario: InsightScenario): Promise<InsightResponse> =>
    api.post(`/companies/${id}/insights/${scenario}`).then((res) => res.data),
}

export const dashboardApi = {
  get: (): Promise<DashboardResponse> => api.get('/dashboard').then((res) => res.data),
}
