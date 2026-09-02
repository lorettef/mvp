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
  list: ({ signal }: { signal?: AbortSignal } = {}): Promise<Company[]> => api.get('/companies', { signal }).then((res) => res.data),
  get: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<Company> => api.get(`/companies/${id}`, { signal }).then((res) => res.data),
  create: (data: CompanyCreate, { signal }: { signal?: AbortSignal } = {}): Promise<Company> =>
    api.post('/companies', data, { signal }).then((res) => res.data),
  update: (id: string, data: CompanyUpdate, { signal }: { signal?: AbortSignal } = {}): Promise<Company> =>
    api.patch(`/companies/${id}`, data, { signal }).then((res) => res.data),
  remove: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<void> =>
    api.delete(`/companies/${id}`, { signal }).then((res) => res.data),
  metrics: (id: string, period?: string, { signal }: { signal?: AbortSignal } = {}): Promise<Metric[]> =>
    api.get(`/companies/${id}/metrics`, { params: period ? { period } : {}, signal }).then((res) => res.data),
  upsertMetric: (id: string, data: MetricUpsert, { signal }: { signal?: AbortSignal } = {}): Promise<Metric> =>
    api.put(`/companies/${id}/metrics`, data, { signal }).then((res) => res.data),
  upsertMetricBulk: (id: string, data: MetricBulkUpsert, { signal }: { signal?: AbortSignal } = {}): Promise<Metric[]> =>
    api.put(`/companies/${id}/metrics/bulk`, data, { signal }).then((res) => res.data),
  cohorts: (id: string, period?: string, { signal }: { signal?: AbortSignal } = {}): Promise<Cohort[]> =>
    api.get(`/companies/${id}/cohorts`, { params: period ? { period } : {}, signal }).then((res) => res.data),
  upsertCohort: (id: string, data: CohortUpsert, { signal }: { signal?: AbortSignal } = {}): Promise<Cohort> =>
    api.put(`/companies/${id}/cohorts`, data, { signal }).then((res) => res.data),
  budgets: (id: string, period?: string, { signal }: { signal?: AbortSignal } = {}): Promise<Budget[]> =>
    api.get(`/companies/${id}/budgets`, { params: period ? { period } : {}, signal }).then((res) => res.data),
  upsertBudget: (id: string, data: BudgetUpsert, { signal }: { signal?: AbortSignal } = {}): Promise<Budget> =>
    api.put(`/companies/${id}/budgets`, data, { signal }).then((res) => res.data),
  unitEconomics: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<UnitEconomicsResponse> =>
    api.get(`/companies/${id}/unit-economics`, { signal }).then((res) => res.data),
  tasks: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<Task[]> =>
    api.get(`/companies/${id}/tasks`, { signal }).then((res) => res.data),
  createTask: (id: string, data: TaskCreate, { signal }: { signal?: AbortSignal } = {}): Promise<Task> =>
    api.post(`/companies/${id}/tasks`, data, { signal }).then((res) => res.data),
  updateTask: (id: string, taskId: string, data: TaskUpdate, { signal }: { signal?: AbortSignal } = {}): Promise<Task> =>
    api.patch(`/companies/${id}/tasks/${taskId}`, data, { signal }).then((res) => res.data),
  deleteTask: (id: string, taskId: string, { signal }: { signal?: AbortSignal } = {}): Promise<void> =>
    api.delete(`/companies/${id}/tasks/${taskId}`, { signal }).then((res) => res.data),
  readiness: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<ReadinessResponse> =>
    api.get(`/companies/${id}/readiness`, { signal }).then((res) => res.data),
  recalculate: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<RecalculateResponse> =>
    api.post(`/companies/${id}/recalculate`, undefined, { signal }).then((res) => res.data),
  generatePlan: (id: string, months = 6, { signal }: { signal?: AbortSignal } = {}): Promise<PlanGenerateResponse> =>
    api.post(`/companies/${id}/generate-plan`, null, { params: { months }, signal }).then((res) => res.data),
  insight: (id: string, scenario: InsightScenario, { signal }: { signal?: AbortSignal } = {}): Promise<InsightResponse> =>
    api.post(`/companies/${id}/insights/${scenario}`, undefined, { signal }).then((res) => res.data),
}

export const dashboardApi = {
  get: ({ signal }: { signal?: AbortSignal } = {}): Promise<DashboardResponse> => api.get('/dashboard', { signal }).then((res) => res.data),
}
