import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CompanyStatusItem } from '@/types/api'
import { fmtRub } from '@/lib/format'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 10

export function DashboardPortfolioTable({ companies, industryLabel, onOpen, filtered }: {
  companies: CompanyStatusItem[]
  industryLabel: (industry: string | null) => string
  onOpen?: (id: string) => void
  filtered: boolean
}) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(companies.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = companies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return <div className="min-w-0 rounded-lg border bg-card">
    {companies.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t(filtered ? 'dashboard.filters.empty' : 'dashboard.lifecycle.activeEmpty')}</p> : <>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead><tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-medium">{t('dashboard.table.company')}</th>
            <th scope="col" className="px-3 py-3 font-medium">{t('dashboard.table.sphere')}</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">{t('dashboard.table.revenueFact')}</th>
            <th scope="col" className="px-3 py-3 font-medium">{t('dashboard.table.status')}</th>
            <th scope="col" className="px-3 py-3 font-medium">{t('dashboard.table.health')}</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">{t('overview.financial.runway')}</th>
          </tr></thead>
          <tbody>{rows.map(company => <tr key={company.id} className="border-b last:border-0">
            <th scope="row" className="px-4 py-3 text-left font-medium">
              {onOpen ? <button type="button" className="text-left hover:underline focus-visible:underline" onClick={() => onOpen(company.id)}>{company.name}</button> : company.name}
            </th>
            <td className="px-3 py-3">{industryLabel(company.industry)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{fmtRub(company.latestRevenue)}</td>
            <td className="px-3 py-3">{t(`dashboard.status.${company.status === 'on_track' ? 'onTrack' : company.status === 'behind' ? 'behind' : company.status === 'no_plan' ? 'noPlan' : 'noData'}`)}</td>
            <td className="px-3 py-3">{t(`overview.health.${company.health === 'healthy' ? 'healthy' : company.health === 'attention' ? 'attention' : company.health === 'critical' ? 'critical' : 'noData'}`)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{company.runwayMonths == null ? '—' : t('overview.kpi.runwayMonths', { value: company.runwayMonths })}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {pageCount > 1 && <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-sm">
        <Button type="button" size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t('dashboard.portfolioTable.previous')}</Button>
        <span aria-live="polite">{currentPage} / {pageCount}</span>
        <Button type="button" size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t('dashboard.portfolioTable.next')}</Button>
      </div>}
    </>}
  </div>
}
