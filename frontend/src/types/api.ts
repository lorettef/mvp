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
  dailyLimit: number | null
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
  provider: string
}

// Subscription
export interface PlanResponse {
  id: string
  name: string
  price: number | null
  pricePerCompany: number | null
  companyLimit: number | null
  aiReportsLimit: number | null
  features: string[]
}

// Company
export interface Company {
  id: string
  organizationId: string
  name: string
  industry: string | null
  geography: string | null
  grossMargin: number
  createdAt: string
}

export interface CompanyCreate {
  name: string
  industry?: string
  geography?: string
  grossMargin?: number
}

export interface CompanyUpdate {
  name?: string
  industry?: string
  geography?: string
  grossMargin?: number
}

// Stored metrics (server-side)
export interface Metric {
  id: string
  companyId: string
  period: string
  type: 'plan' | 'fact'
  newUnits: number
  arpu: number
  revenue: number
  marketingSpend: number
  retentionRate: number
  churn: number
  ltv: number
  cac: number
  activeUnits: number | null
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface MetricUpsert {
  period: string
  type: 'plan' | 'fact'
  new_units: number
  arpu: number
  revenue: number
  marketing_spend: number
  retention_rate: number
  comment?: string
}

export interface MetricBulkUpsert {
  items: MetricUpsert[]
}

// Dashboard
export interface CompanyStatusItem {
  id: string
  name: string
  industry: string | null
  geography: string | null
  status: 'on_track' | 'behind' | 'no_plan' | 'no_data'
  latestRevenue: number | null
  latestPlanRevenue: number | null
  taskProgress: number | null
}

export interface DashboardResponse {
  totalCompanies: number
  avgRevenue: number | null
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
  size: number
  retentionM1: number
  retentionM2: number
  retentionM3: number
  retentionM4: number
  retentionM5: number
  retentionM6: number
  retentionM7: number
  retentionM8: number
  retentionM9: number
  retentionM10: number
  retentionM11: number
  retentionM12: number
  marketingSpend: number | null
  createdAt: string
  updatedAt: string
}

export interface CohortUpsert {
  period: string
  type: 'plan' | 'fact'
  size: number
  retention_m1: number
  retention_m2: number
  retention_m3: number
  retention_m4: number
  retention_m5: number
  retention_m6: number
  retention_m7: number
  retention_m8: number
  retention_m9: number
  retention_m10: number
  retention_m11: number
  retention_m12: number
  marketing_spend?: number
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

// Unit economics (server-side summary)
export interface RetentionBreakdown {
  m1: number | null
  m3: number | null
  m6: number | null
  m12: number | null
}

export interface UnitEconomicsResponse {
  companyId: string
  revenue: number | null
  cac: number | null
  ltv: number | null
  churn: number | null
  ltvCac: number | null
  runwayMonths: number | null
  paybackPeriod: number | null
  romi: number | null
  cash: number | null
  monthlyBurn: number | null
  magicNumber: number | null
  revenueGrowth: number | null
  marketingSpend: number | null
  retention: RetentionBreakdown
  alerts: string[]
}

// Task system (sale-readiness, main USP)
export type TaskStage = 'metrics' | 'documents' | 'negotiations' | 'presentation'
export type TaskStatus = 'pending' | 'in_progress' | 'done'

export interface Task {
  id: string
  companyId: string
  title: string
  description: string | null
  stage: TaskStage
  status: TaskStatus
  effectiveStatus: TaskStatus | 'overdue'
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskCreate {
  title: string
  description?: string
  stage: TaskStage
  status: TaskStatus
  due_date?: string
}

export interface TaskUpdate {
  title?: string
  description?: string
  stage?: TaskStage
  status?: TaskStatus
  due_date?: string
}

export interface StageProgress {
  stage: TaskStage
  label: string
  total: number
  done: number
  percent: number
}

export interface ReadinessResponse {
  companyId: string
  readiness: number
  totalTasks: number
  doneTasks: number
  stages: StageProgress[]
  risks: string[]
  summary: string
}

// Market analysis
export type MarketIndustry = 'saas' | 'fintech' | 'ecommerce' | 'edtech' | 'healthtech' | 'ai' | 'other'
export type MarketGeography = 'RU' | 'KZ' | 'global'

export interface MarketAnalysisRequest {
  industry: MarketIndustry
  geography: MarketGeography
  horizon: number
}

export interface MacroIndicators {
  gdpGrowth: number
  inflation: number
  keyRate: number
}

export interface MarketImpact {
  mrrFactor: number
  cacFactor: number
  churnFactor: number
}

export interface MarketAnalysisResponse {
  industry: MarketIndustry
  industryLabel: string
  geography: MarketGeography
  geographyLabel: string
  horizon: number
  macro: MacroIndicators
  marketSize: number
  marketSizeProjected: number
  marketGrowth: number
  trends: string[]
  impact: MarketImpact
  summary: string
}

// Hiring forecast (staff plan + social payments)
export interface HiringSettingsResponse {
  companyId: string
  ndflRate: number
  insuranceRate: number
  injuryRate: number
  totalRate: number
}

export interface HiringSettingsUpsert {
  ndfl_rate: number
  insurance_rate: number
  injury_rate: number
}

export interface HiringMonthRow {
  month: number
  period: string
  revenue: number
  fot: number
  socialPayments: number
  totalCost: number
  headcount: number
  devCount: number
  salesCount: number
  marketingCount: number
}

export interface HiringPlanResponse {
  companyId: string
  industry: string
  industryLabel: string
  baseRevenue: number | null
  fotShare: number
  avgSalary: number
  monthlyGrowth: number
  settings: HiringSettingsResponse
  months: HiringMonthRow[]
  finalHeadcount: number
  summary: string
}

// P&L (profit & loss statement)
export interface PnLResponse {
  companyId: string
  period: string | null
  mrr: number | null
  oneTimeRevenue: number
  revenue: number | null
  fot: number | null
  socialPayments: number | null
  marketing: number | null
  development: number | null
  gna: number | null
  totalOpex: number | null
  ebitda: number | null
  financialExpenses: number
  netProfit: number | null
  ebitdaMargin: number | null
  netMargin: number | null
  summary: string
}

// Cash flow statement
export interface CashFlowResponse {
  companyId: string
  period: string | null
  netProfit: number | null
  amortization: number
  operatingCf: number | null
  capex: number
  investingCf: number
  investments: number
  credits: number
  financingCf: number
  totalCf: number | null
  openingBalance: number
  closingBalance: number | null
  summary: string
}

// Credit forecasting (cash gap detection)
export interface CashProjectionMonth {
  month: number
  period: string
  revenue: number
  opex: number
  netCf: number
  balanceBefore: number
  balanceAfter: number
}

export interface CreditGap {
  month: number
  period: string
  balanceBefore: number
  gap: number
  creditAmount: number
  rate: number
}

export interface CreditForecastResponse {
  companyId: string
  geography: string
  keyRate: number
  creditRate: number
  openingCash: number
  baseRevenue: number | null
  baseOpex: number | null
  months: CashProjectionMonth[]
  gaps: CreditGap[]
  totalCreditNeeded: number
  summary: string
}

// Gordon growth model valuation
export interface ValuationResponse {
  companyId: string
  geography: string
  keyRate: number
  discountRate: number
  growthRate: number
  fcf: number | null
  terminalValue: number | null
  debt: number
  cash: number
  netDebt: number
  equityValue: number | null
  revenueAnnual: number | null
  psRatio: number | null
  headcount: number
  valuePerEmployee: number | null
  summary: string
}

// Sensitivity analysis (conservative scenario)
export interface Scenario {
  equityValue: number | null
  terminalValue: number | null
  fcf: number | null
  growthRate: number | null
  mrr: number | null
  cac: number | null
  ltv: number | null
  churn: number | null
  ltvCac: number | null
}

export interface SensitivityResponse {
  companyId: string
  geography: string
  keyRate: number
  discountRate: number
  base: Scenario
  conservative: Scenario
  equityDelta: number | null
  equityDeltaPct: number | null
  summary: string
}

// Forced recalculation (TZ v5.0, section 18)
export interface RecalculateResponse {
  companyId: string
  recalculatedAt: string
  revenue: number | null
  runwayMonths: number | null
  ltvCac: number | null
  ebitda: number | null
  netProfit: number | null
  totalCf: number | null
  equityValue: number | null
  totalCreditNeeded: number | null
  summary: string
}

// AI plan generation (TZ v5.0, section 7.1)
export interface PlanMetricItem {
  period: string
  newUnits: number
  arpu: number
  revenue: number
  marketingSpend: number
  retentionRate: number
}

export interface PlanGenerateResponse {
  companyId: string
  provider: string
  summary: string
  metrics: PlanMetricItem[]
}

// AI insight (narrative) per module (TZ v5.0, section 2.3)
export type InsightScenario =
  | 'unit_economics'
  | 'cohorts'
  | 'budget'
  | 'readiness'
  | 'hiring'
  | 'pnl'
  | 'cashflow'
  | 'credit'
  | 'valuation'
  | 'sensitivity'
  | 'reports'

export interface InsightResponse {
  companyId: string
  scenario: string
  provider: string
  text: string
}
