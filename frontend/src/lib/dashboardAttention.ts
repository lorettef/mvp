import type { TFunction } from 'i18next'
import type { CompanyStatusItem } from '@/types/api'

/** Presentation only: preserve backend reasons and rules, expand dashboard CAC wording. */
export function dashboardAttentionLabel(signal: CompanyStatusItem['attention'][number], t: TFunction): string {
  return signal.kind === 'cac_rising' ? t('dashboard.attention.cacRising') : signal.label
}
