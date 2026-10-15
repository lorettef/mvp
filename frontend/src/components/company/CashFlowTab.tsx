import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CashFlowMonth, CashFlowResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtRub, formatMonthLabel } from '@/lib/format'
import { FinanceMatrix } from './FinanceMatrix'
import { CompanyCashFlowChart } from './CompanyProfileCharts'

interface CashFlowTabProps { data?: CashFlowResponse; isLoading?: boolean }
const rows: Array<{ key: Exclude<keyof CashFlowMonth, 'period'>; label: string; bold?: boolean }> = [
  { key: 'netProfit', label: 'netProfit' },
  { key: 'operatingCf', label: 'operatingRow' },
  { key: 'investingCf', label: 'investingRow' },
  { key: 'financingCf', label: 'financingRow' },
  { key: 'totalCf', label: 'totalRow', bold: true },
  { key: 'netCashFlow', label: 'netRow', bold: true },
  { key: 'closingBalance', label: 'balanceRow', bold: true },
]

export function CashFlowTab({ data, isLoading }: CashFlowTabProps) {
  const { t, i18n } = useTranslation()
  const selectorId = useId()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  // A sorted copy: the query cache and API order remain untouched.
  const months = [...(data?.months ?? [])].sort((a, b) => a.period.localeCompare(b.period))
  const selected = months.find(m => m.period === selectedMonth) ?? months[months.length - 1]
  const monthLabel = (period: string) => formatMonthLabel(period.slice(0, 7), i18n.language)
  const matrixRows = rows.map(row => ({ ...row, label: t(`company.cashflow.${row.label}`) }))
  const matrix = (visible: CashFlowMonth[], mobile: boolean) => <FinanceMatrix mode="single"
    periods={visible.map(m => m.period)} rows={matrixRows} mobile={mobile}
    columnLabel={t('company.budget.article')} tableLabel={t(mobile ? 'company.cashflow.mobileMatrix' : 'company.cashflow.matrix')}
    renderCell={(row, period) => <span>{fmtRub(visible.find(m => m.period === period)?.[row.key])}</span>} />

  if (isLoading) return <Card><CardContent className="p-4"><Skeleton className="mb-4 h-6 w-56" /><Skeleton className="h-64 w-full" /></CardContent></Card>
  if (!months.length) return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('company.cashflow.empty')}</p></CardContent></Card>
  return <Card className="min-w-0 max-w-full border bg-card">
    <CardContent className="min-w-0 p-3 sm:p-4">
      <h3 className="font-semibold">{t('company.cashflow.title')}</h3>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">{t('company.cashflow.sourceHelp')}</p>
      <section className="mb-4 min-w-0" aria-label={t('company.profile.charts.cashflow')}>
        <h4 className="mb-3 font-medium">{t('company.profile.charts.cashflow')}</h4>
        <CompanyCashFlowChart months={months} />
      </section>
      <div className="hidden min-w-0 max-w-full overflow-x-auto md:block" data-testid="cashflow-desktop">{matrix(months, false)}</div>
      <div className="md:hidden" data-testid="cashflow-mobile">
        <label htmlFor={selectorId} className="mb-1 block text-sm font-medium">{t('common.period')}</label>
        <select id={selectorId} className="mb-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={selected?.period ?? ''} onChange={event => setSelectedMonth(event.target.value)}>
          {months.map(m => <option key={m.period} value={m.period}>{monthLabel(m.period)}</option>)}
        </select>
        {selected && matrix([selected], true)}
      </div>
    </CardContent>
  </Card>
}
