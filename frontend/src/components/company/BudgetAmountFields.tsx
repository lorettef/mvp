import { useTranslation } from 'react-i18next'
import { GnaInputHelper } from './GnaInputHelper'
import { Input } from '@/components/ui/input'
import { budgetInputFields, type BudgetInputField } from '@/lib/financialSourceForm'

interface Props {
  prefix: string
  values: Record<BudgetInputField, string>
  errors: Partial<Record<BudgetInputField, string>>
  disabled?: boolean
  cogsRequired?: boolean
  industry?: string | null
  onChange: (field: BudgetInputField, value: string) => void
  onBadInput?: (field: BudgetInputField, bad: boolean) => void
  onBlur?: (field: BudgetInputField) => void
}

/** The same stored Budget amounts in the standalone source editor and wizard. */
export function BudgetAmountFields({ prefix, values, errors, disabled, cogsRequired = true, industry, onChange, onBlur, onBadInput }: Props) {
  const { t } = useTranslation()
  return <>{budgetInputFields.map((field) => <div key={field} className="min-w-0 space-y-1">
    <label htmlFor={`${prefix}-${field}`} className="block text-sm font-medium">{t(`company.budget.${field}`)}</label>
    <Input id={`${prefix}-${field}`} type="number" inputMode="decimal" min={0} step="any" required={field !== 'cogs' || cogsRequired} disabled={disabled}
      value={values[field]} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${prefix}-${field}-error` : undefined}
      onInput={event => onBadInput?.(field, event.currentTarget.validity.badInput)} onChange={(event) => onChange(field, event.target.value)} onBlur={() => onBlur?.(field)} />
    {field === 'cogs' && !cogsRequired && <p className="text-xs text-muted-foreground">{t('company.budget.legacyCogs')}</p>}
    {field === 'gna' && <GnaInputHelper key={industry} industry={industry} disabled={disabled} onApply={total => onChange('gna', String(total))} />}
    {errors[field] && <p id={`${prefix}-${field}-error`} className="text-sm text-destructive">{errors[field]}</p>}
  </div>)}</>
}
