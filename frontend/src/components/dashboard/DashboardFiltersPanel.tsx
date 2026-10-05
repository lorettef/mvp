import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, PanelLeftClose, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { DashboardFilters, DashboardHealth, DashboardPerformanceStatus } from '@/types/api'

interface Option { value: string; label: string }
interface OptionsState {
  options: Option[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

function FilterSelection({ label, summary, selected, onChange, options, isLoading, isError, onRetry }: OptionsState & {
  label: string; summary: string; selected: string[]; onChange: (values: string[]) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [menuContainer, setMenuContainer] = useState<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  return (
    <div ref={setMenuContainer} className="min-w-0 space-y-1.5">
      <Label id={id} className="text-xs font-medium">{label}</Label>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-9 w-full justify-between gap-2 px-3 text-xs" aria-label={`${label}: ${summary}`}>
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        {/* Keep menu focus inside a containing Sheet's focus boundary. */}
        <DropdownMenuContent container={menuContainer} align="start" aria-labelledby={id}
          onEscapeKeyDown={event => { event.preventDefault(); setOpen(false) }}
          className="max-h-64 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto">
          {isLoading ? <p role="status" className="p-2 text-xs text-muted-foreground">{t('dashboard.filters.optionsLoading')}</p> : isError ? (
            <div className="space-y-2 p-2">
              <p role="alert" className="text-xs text-destructive">{t('dashboard.filters.optionsError')}</p>
              <Button size="sm" variant="outline" onClick={onRetry}>{t('common.retry')}</Button>
            </div>
          ) : options.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">{t('dashboard.filters.noOptions')}</p>
          ) : options.map(option => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.includes(option.value)}
              onSelect={event => event.preventDefault()}
              onCheckedChange={checked => onChange(checked
                ? [...selected, option.value] : selected.filter(value => value !== option.value))}
            >
              <span className="min-w-0 break-words">{option.label}</span>
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={selected.length === 0} onSelect={() => onChange([])}>
            {t('dashboard.filters.clearSelection')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function DashboardFiltersPanel({ filters, onChange, onReset, invalidRange, activeGroups, canReset, companies, industries, onCollapse }: {
  filters: DashboardFilters
  onChange: (filters: DashboardFilters) => void
  onReset: () => void
  invalidRange: boolean
  activeGroups: number
  canReset: boolean
  companies: OptionsState
  industries: OptionsState
  onCollapse?: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const healthOptions: { value: DashboardHealth; label: string }[] = [
    { value: 'healthy', label: t('overview.health.healthy') },
    { value: 'attention', label: t('overview.health.attention') },
    { value: 'critical', label: t('overview.health.critical') },
    { value: 'no_data', label: t('overview.health.noData') },
  ]
  const performanceOptions: { value: DashboardPerformanceStatus; label: string }[] = [
    { value: 'on_track', label: t('dashboard.status.onTrack') },
    { value: 'behind', label: t('dashboard.filters.behind') },
    { value: 'no_plan', label: t('dashboard.filters.noPlan') },
    { value: 'no_data', label: t('dashboard.status.noData') },
  ]

  return (
    <div className="space-y-4">
      {onCollapse && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('dashboard.filters.title')}{activeGroups > 0 && <span className="text-xs text-muted-foreground">· {activeGroups}</span>}
          </h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('dashboard.filters.collapse')} onClick={onCollapse}>
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
      <FilterSelection label={t('dashboard.filters.companies')}
        summary={filters.companyIds?.length ? t('dashboard.filters.companyCount', { count: filters.companyIds.length }) : t('dashboard.filters.allCompanies')}
        selected={filters.companyIds ?? []} onChange={companyIds => onChange({ ...filters, companyIds })} {...companies} />

      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-1.5 text-xs font-medium">{t('dashboard.filters.period')}</legend>
        {(['periodFrom', 'periodTo'] as const).map(field => (
          <div key={field} className="space-y-1">
            <Label htmlFor={`${id}-${field}`} className="text-xs text-muted-foreground">
              {t(field === 'periodFrom' ? 'dashboard.filters.from' : 'dashboard.filters.to')}
            </Label>
            <Input id={`${id}-${field}`} type="date" className="min-w-0 text-xs" value={filters[field] ?? ''}
              aria-invalid={invalidRange} aria-describedby={`${id}-period-help`}
              onChange={event => onChange({ ...filters, [field]: event.target.value || undefined })} />
          </div>
        ))}
        <p id={`${id}-period-help`} role={invalidRange ? 'alert' : undefined} className={invalidRange ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {t(invalidRange ? 'dashboard.filters.invalidRange' : 'dashboard.filters.inclusive')}
        </p>
      </fieldset>

      <FilterSelection label={t('dashboard.filters.industry')}
        summary={filters.industries?.length ? t('dashboard.filters.selectedCount', { count: filters.industries.length }) : t('dashboard.filters.allIndustries')}
        selected={filters.industries ?? []} onChange={selected => onChange({ ...filters, industries: selected })} {...industries} />
      <FilterSelection label={t('dashboard.filters.health')}
        summary={filters.health?.length ? t('dashboard.filters.selectedCount', { count: filters.health.length }) : t('dashboard.filters.allHealth')}
        options={healthOptions} selected={filters.health ?? []} onChange={selected => onChange({ ...filters, health: selected as DashboardHealth[] })} />
      <FilterSelection label={t('dashboard.filters.performance')}
        summary={filters.performanceStatus?.length ? t('dashboard.filters.selectedCount', { count: filters.performanceStatus.length }) : t('dashboard.filters.allPerformance')}
        options={performanceOptions} selected={filters.performanceStatus ?? []} onChange={selected => onChange({ ...filters, performanceStatus: selected as DashboardPerformanceStatus[] })} />

      <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-xs" disabled={!canReset} onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t('dashboard.filters.reset')}
      </Button>
    </div>
  )
}
