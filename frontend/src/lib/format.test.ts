import { describe, expect, it } from 'vitest'
import { fmtPct, fmtPercent, fmtPeriod, fmtRub } from './format'

describe('fmtRub', () => {
  it('formats rubles with ru-RU grouping', () => {
    // toLocaleString('ru-RU') uses U+00A0 (NBSP) as the thousands separator
    expect(fmtRub(123456)).toBe('₽123\u00A0456')
  })

  it('renders an em dash for null/undefined', () => {
    expect(fmtRub(null)).toBe('—')
    expect(fmtRub(undefined)).toBe('—')
  })
})

describe('fmtPct (fraction input, multiplies by 100)', () => {
  it('converts a fraction to percent with one decimal', () => {
    expect(fmtPct(0.82)).toBe('82.0%')
  })

  it('renders an em dash for null/undefined', () => {
    expect(fmtPct(null)).toBe('—')
    expect(fmtPct(undefined)).toBe('—')
  })
})

describe('fmtPercent (already-percentage-points input, no multiply)', () => {
  it('renders percentage points without multiplying', () => {
    expect(fmtPercent(21)).toBe('21.0%')
    expect(fmtPercent(8.5)).toBe('8.5%')
  })

  it('renders an em dash for null/undefined', () => {
    expect(fmtPercent(null)).toBe('—')
    expect(fmtPercent(undefined)).toBe('—')
  })
})

describe('fmtPeriod', () => {
  it('truncates an ISO period to YYYY-MM', () => {
    expect(fmtPeriod('2024-05-01')).toBe('2024-05')
  })

  it('renders an em dash for null/undefined/empty', () => {
    expect(fmtPeriod(null)).toBe('—')
    expect(fmtPeriod(undefined)).toBe('—')
    expect(fmtPeriod('')).toBe('—')
  })
})
