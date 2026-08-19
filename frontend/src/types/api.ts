// Auth
export interface RegisterRequest {
  email: string
  password: string
  fullName?: string
  companyName?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  token_type: string
  expires_in: number
}

export interface UserResponse {
  id: string
  email: string
  fullName: string | null
  companyName: string | null
  role: string
  organizationId: string | null
  companyId: string | null
  createdAt: string
  subscriptionPlan: string
  dailyLimit: number
  usedToday: number
}

export interface SeedResponse {
  email: string
}

// Metrics
export interface MetricsRequest {
  mrr: number
  cac: number
  ltv: number
  churn: number
  arpu: number
  runway_months: number
  stage: string
  active_users?: number
}

export interface MetricsResponse {
  mrr: number
  cac: number
  ltv: number
  churn: number
  arpu: number
  runway_months: number
  ltv_cac_ratio: number
  healthy: boolean
  alerts: string[]
}

// Forecast
export interface ForecastRequest {
  history: number[]
  months: number
  method: 'linear' | 'polynomial' | 'prophet'
}

export interface ForecastResponse {
  predictions: number[]
  confidence_interval?: { lower: number[]; upper: number[] }
  method: string
}

// Recommendations
export interface RecommendationAction {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: string
}

export interface RecommendationResponse {
  summary: string
  recommendations: RecommendationAction[]
  raw_response: string | null
}

// Subscription
export interface SubscriptionStatus {
  plan: string
  daily_limit: number
  used_today: number
}

// Company
export interface Company {
  id: string
  organizationId: string
  name: string
  industry: string | null
  geography: string | null
  createdAt: string
}

export interface CompanyCreate {
  name: string
  industry?: string
  geography?: string
}

export interface CompanyUpdate {
  name?: string
  industry?: string
  geography?: string
}

// Stored metrics (server-side)
export interface Metric {
  id: string
  companyId: string
  period: string
  type: 'plan' | 'fact'
  mrr: number
  cac: number
  ltv: number
  churn: number
  arpu: number | null
  runwayMonths: number | null
  stage: string | null
  createdAt: string
  updatedAt: string
}

export interface MetricUpsert {
  period: string
  type: 'plan' | 'fact'
  mrr: number
  cac: number
  ltv: number
  churn: number
  arpu?: number
  runway_months?: number
  stage?: string
}

// Dashboard
export interface CompanyStatusItem {
  id: string
  name: string
  industry: string | null
  geography: string | null
  status: 'on_track' | 'behind' | 'no_plan' | 'no_data'
  latestMrr: number | null
  latestPlanMrr: number | null
}

export interface DashboardResponse {
  totalCompanies: number
  avgMrr: number | null
  avgCac: number | null
  avgLtv: number | null
  avgChurn: number | null
  onTrack: number
  behind: number
  noPlan: number
  noData: number
  companies: CompanyStatusItem[]
}

export interface Cohort {
  id: string
  companyId: string
  period: string
  type: 'plan' | 'fact'
  retentionM1: number
  retentionM3: number
  retentionM6: number
  retentionM12: number
  createdAt: string
  updatedAt: string
}

export interface CohortUpsert {
  period: string
  type: 'plan' | 'fact'
  retention_m1: number
  retention_m3: number
  retention_m6: number
  retention_m12: number
}

export interface Budget {
  id: string
  companyId: string
  period: string
  type: 'plan' | 'fact'
  marketing: number
  development: number
  fot: number
  gna: number
  createdAt: string
  updatedAt: string
}

export interface BudgetUpsert {
  period: string
  type: 'plan' | 'fact'
  marketing: number
  development: number
  fot: number
  gna: number
}
