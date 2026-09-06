// Canonical formatters — single source of truth for currency/percent/period display.

export const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${Math.round(v).toLocaleString('ru-RU')}`

export const fmtPeriod = (period: string | null | undefined) =>
  period ? period.slice(0, 7) : '—'

export const formatMonthLabel = (
  yearMonth: string | null | undefined,
  locale = 'ru-RU',
) => {
  if (!yearMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) return '—'

  const [yearText, monthText] = yearMonth.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const date = new Date(Date.UTC(year, month - 1, 1))
  const resolvedLocale = locale.toLowerCase().startsWith('en') ? 'en-US' : 'ru-RU'
  const monthName = new Intl.DateTimeFormat(resolvedLocale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(date)

  return `${monthName.charAt(0).toLocaleUpperCase(resolvedLocale)}${monthName.slice(1)} ${year}`
}

// Input is a FRACTION (0–1), e.g. retention 0.82 → "82.0%".
// Multiplies by 100. Use for churn, retention, margins, romi, rate fractions.
export const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`

// Input is ALREADY percentage points, e.g. key_rate 21.0 → "21.0%".
// Does NOT multiply. Use for key_rate, credit_rate, discount_rate, growth_rate.
export const fmtPercent = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(1)}%`

// Signed number with explicit sign, e.g. 18.4 → "+18.4", -3.2 → "-3.2".
// Use for deviations/deltas where sign must always be shown.
export const fmtSigned = (v: number | null | undefined, decimals = 1) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}`

// Signed percentage, e.g. 18.4 → "+18.4%", -3.2 → "-3.2%".
export const fmtSignedPct = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

// Multiplier as suffix, e.g. 1.234 → "1.23×".
export const fmtFactor = (v: number | null | undefined, decimals = 2) =>
  v == null ? '—' : `${v.toFixed(decimals)}×`
