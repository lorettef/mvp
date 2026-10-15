import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { BudgetSource, BudgetUpsert, MetricUpsert, UnitEconomicsMetricSource } from '@/types/api'
import { InlineSourceCell } from '@/components/shared/inline-source-cell'
import { budgetInputFields, budgetSourceUpdate, metricInputValues, metricSourceUpdate, numericInputError, type BudgetInputField, type MetricInputField } from '@/lib/financialSourceForm'

interface CommonProps { label: string; children: ReactNode; busy?: boolean }

export function MetricInlineCell({ source, field, onSave, ...props }: CommonProps & {
  source: UnitEconomicsMetricSource; field: MetricInputField; onSave: (data: MetricUpsert) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const values = metricInputValues(source)
  return <InlineSourceCell {...props} value={values[field]} step={field === 'new_units' ? '1' : 'any'} max={field === 'retention_rate' ? 100 : undefined}
    validate={(draft) => {
      const error = numericInputError(draft, field)
      if (error) return t(error)
      if (Object.entries(values).some(([key, raw]) => key !== field && numericInputError(raw, key as MetricInputField))) return t('company.inline.incompleteSource')
    }}
    isUnchanged={(draft) => Number(draft) === Number(values[field])}
    onSave={(draft) => onSave(metricSourceUpdate(source, field, draft))} />
}

export function BudgetInlineCell({ source, field, onSave, ...props }: CommonProps & {
  source: BudgetSource; field: BudgetInputField; onSave: (data: BudgetUpsert) => Promise<unknown>
}) {
  const { t } = useTranslation()
  return <InlineSourceCell {...props} value={source[field] == null ? '' : String(source[field])}
    validate={(draft) => {
      const error = numericInputError(draft)
      if (error) return t(error)
      if (budgetInputFields.some((key) => key !== field && !(key === 'cogs' && source.cogs == null) && (source[key] == null || numericInputError(String(source[key]))))) return t('company.inline.incompleteSource')
    }}
    isUnchanged={(draft) => Number(draft) === source[field]}
    onSave={(draft) => onSave(budgetSourceUpdate(source, field, draft))} />
}
