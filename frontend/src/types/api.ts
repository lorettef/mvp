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
  full_name: string | null
  company_name: string | null
  created_at: string
  subscription_plan: string
  daily_limit: number
  used_today: number
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
