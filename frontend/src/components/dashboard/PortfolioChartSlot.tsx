import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import type { DashboardResponse, PerformancePoint } from '@/types/api'
import { QueryState } from '@/components/common/QueryState'
import { Section } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PortfolioRevenueChart } from './PortfolioRevenueChart'
import { CompanyRevenueShareChart } from './CompanyRevenueShareChart'
import { CompanyRevenueComparisonChart } from './CompanyRevenueComparisonChart'
import { IndustryProfitabilityChart } from './IndustryProfitabilityChart'

const portfolioChartVariants = [
  { value: 'revenue', titleKey: 'dashboard.performance.title' },
  { value: 'share', titleKey: 'dashboard.companyRevenue.shareTitle' },
  { value: 'comparison', titleKey: 'dashboard.companyRevenue.comparisonTitle' },
  { value: 'profitability', titleKey: 'dashboard.profitability.title' },
] as const
export type PortfolioChartVariant = typeof portfolioChartVariants[number]['value']

interface DataState<T> {
  data?: T
  isLoading: boolean
  isError: boolean
  error?: unknown
  onRetry: () => void
}

interface Props {
  number: 1 | 2
  defaultVariant: PortfolioChartVariant
  dashboard: DataState<DashboardResponse>
  performance: DataState<PerformancePoint[]>
  industryLabel: (slug: string) => string
}

/** Each instance owns its selection; sources and fetching belong to the page. */
export function PortfolioChartSlot({ number, defaultVariant, dashboard, performance, industryLabel }: Props) {
  const { t } = useTranslation()
  const [variant, setVariant] = useState<PortfolioChartVariant>(defaultVariant)
  const title = t(portfolioChartVariants.find((item) => item.value === variant)!.titleKey)
  const source = variant === 'revenue' ? performance : dashboard
  const chart = () => {
    switch (variant) {
      case 'revenue': return <PortfolioRevenueChart data={performance.data ?? []} />
      case 'share': return <CompanyRevenueShareChart embedded companies={dashboard.data?.companies ?? []} />
      case 'comparison': return <CompanyRevenueComparisonChart embedded companies={dashboard.data?.companies ?? []} />
      case 'profitability': return <IndustryProfitabilityChart embedded data={dashboard.data?.profitabilityByIndustry ?? []} industryLabel={industryLabel} />
    }
  }

  return <div role="group" aria-label={t('dashboard.chartSlots.slot', { number })} className="min-w-0 w-full">
    <Section title={title} description={variant === 'profitability' ? t('dashboard.profitability.subtitle') : undefined}
      className="h-full" headerClassName="px-4 py-3" contentClassName="p-4"
      actions={<DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={t('dashboard.chartSlots.switch')}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
          <DropdownMenuRadioGroup value={variant} onValueChange={(value) => {
            if (portfolioChartVariants.some((item) => item.value === value)) setVariant(value as PortfolioChartVariant)
          }}>
            {portfolioChartVariants.map((item) => <DropdownMenuRadioItem key={item.value} value={item.value} className="whitespace-normal">
              {t(item.titleKey)}
            </DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>}>
      <QueryState isLoading={source.isLoading} isError={source.isError} error={source.error} onRetry={source.onRetry}>
        {chart()}
      </QueryState>
    </Section>
  </div>
}
