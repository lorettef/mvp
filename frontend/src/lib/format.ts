// Canonical formatters — single source of truth for currency/percent/period display.

export const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`

export const fmtPeriod = (period: string | null | undefined) =>
  period ? period.slice(0, 7) : '—'

// Input is a FRACTION (0–1), e.g. retention 0.82 → "82.0%".
// Multiplies by 100. Use for churn, retention, margins, romi, rate fractions.
export const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`

// Input is ALREADY percentage points, e.g. key_rate 21.0 → "21.0%".
// Does NOT multiply. Use for key_rate, credit_rate, discount_rate, growth_rate.
export const fmtPercent = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(1)}%`
