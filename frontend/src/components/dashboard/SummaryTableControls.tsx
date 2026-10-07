import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { CompanyStatusItem } from '@/types/api'

export const PORTFOLIO_SELECTION = 'portfolio'

export function SummaryTableControls({ companies, companyId, onCompanyChange, metrics, selectedMetrics, onMetricsChange }: {
  companies: CompanyStatusItem[]
  companyId: string
  onCompanyChange: (id: string) => void
  metrics: { key: string; label: string }[]
  selectedMetrics: string[]
  onMetricsChange: (keys: string[]) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
        aria-label={t(expanded ? 'dashboard.summary.hideFilters' : 'dashboard.summary.showFilters')}
        aria-expanded={expanded} aria-controls={`${id}-controls`} onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      <div id={`${id}-controls`} hidden={!expanded} className={expanded ? 'flex min-w-0 flex-1 flex-wrap items-end gap-2 sm:flex-none' : undefined}>
        <div className="min-w-0 flex-1 space-y-1 sm:w-52 sm:flex-none">
          <Label htmlFor={`${id}-company`} className="text-xs text-muted-foreground">{t('dashboard.summary.company')}</Label>
          <Select value={companyId} onValueChange={onCompanyChange}>
            <SelectTrigger id={`${id}-company`} className="h-8 text-xs" disabled={companies.length === 0}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)]">
              <SelectItem value={PORTFOLIO_SELECTION}>{t('dashboard.summary.portfolio')}</SelectItem>
              {companies.map(company => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label id={`${id}-metrics-label`} className="block text-xs text-muted-foreground">{t('dashboard.summary.metrics')}</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" aria-labelledby={`${id}-metrics-label ${id}-metrics-count`}>
                <span id={`${id}-metrics-count`}>{selectedMetrics.length} / {metrics.length}</span>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
              {metrics.map(metric => {
                const checked = selectedMetrics.includes(metric.key)
                return (
                  <DropdownMenuCheckboxItem key={metric.key} checked={checked}
                    disabled={checked && selectedMetrics.length === 1}
                    onSelect={event => event.preventDefault()}
                    onCheckedChange={next => onMetricsChange(next
                      ? [...selectedMetrics, metric.key] : selectedMetrics.filter(key => key !== metric.key))}>
                    {metric.label}
                  </DropdownMenuCheckboxItem>
                )
              })}
              <p className="px-2 pt-2 text-xs text-muted-foreground">{t('dashboard.summary.keepMetric')}</p>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
