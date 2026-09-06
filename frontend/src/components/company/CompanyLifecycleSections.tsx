import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'

import { companiesApi } from '@/api/companies'
import { catalogApi } from '@/api/catalog'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/shared/section'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { fmtRub } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import type { Company, CompanyStatusItem } from '@/types/api'

interface CompanyLifecycleSectionsProps {
  readonly tenantKey: string
  readonly dashboardCompanies: readonly CompanyStatusItem[]
}

type Status = CompanyStatusItem['status']

const statusTone: Record<Status, StatusTone> = {
  on_track: 'success',
  behind: 'danger',
  no_plan: 'neutral',
  no_data: 'neutral',
}

export function CompanyLifecycleSections({ tenantKey, dashboardCompanies }: CompanyLifecycleSectionsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const activeQuery = useQuery({
    queryKey: qk.companies(tenantKey, false),
    queryFn: ({ signal }) => companiesApi.list({ signal }),
  })
  const archivedQuery = useQuery({
    queryKey: qk.companies(tenantKey, true),
    queryFn: ({ signal }) => companiesApi.list({ signal, archived: true }),
  })
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
  })

  const industryLabels = new Map(
    (catalogQuery.data?.industries ?? []).map((item) => [item.slug, item.label]),
  )
  const businessModelLabels = new Map(
    (catalogQuery.data?.business_models ?? []).map((item) => [item.slug, item.label]),
  )
  const industryLabel = (slug: string | null) =>
    slug ? (industryLabels.get(slug) ?? slug) : '—'
  const businessModelLabel = (slug: string | null) =>
    slug ? (businessModelLabels.get(slug) ?? slug) : null

  const invalidateCompanyViews = (companyId: string) => {
    void queryClient.invalidateQueries({ queryKey: qk.dashboard(tenantKey) })
    void queryClient.invalidateQueries({ queryKey: qk.companies(tenantKey, false) })
    void queryClient.invalidateQueries({ queryKey: qk.companies(tenantKey, true) })
    void queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, companyId) })
  }

  const archiveMutation = useMutation({
    mutationFn: (companyId: string) => companiesApi.archive(companyId),
    onSuccess: (_, companyId) => invalidateCompanyViews(companyId),
  })
  const restoreMutation = useMutation({
    mutationFn: (companyId: string) => companiesApi.restore(companyId),
    onSuccess: (_, companyId) => invalidateCompanyViews(companyId),
  })
  const deleteMutation = useMutation({
    mutationFn: (companyId: string) => companiesApi.remove(companyId),
    onSuccess: (_, companyId) => {
      invalidateCompanyViews(companyId)
      setPendingDeleteId(null)
    },
  })

  const statusLabel: Record<Status, string> = {
    on_track: t('dashboard.status.onTrack'),
    behind: t('dashboard.status.behind'),
    no_plan: t('dashboard.status.noPlan'),
    no_data: t('dashboard.status.noData'),
  }
  const dashboardById = new Map(dashboardCompanies.map((company) => [company.id, company]))
  const isMutating = archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending

  const openCompany = (companyId: string) => navigate(`/companies/${companyId}`)

  const renderCompany = (company: Company, archived: boolean) => {
    const summary = dashboardById.get(company.id)
    const status = summary?.status ?? 'no_data'
    const isDeletePending = pendingDeleteId === company.id

    return (
      <div key={company.id} className="px-5 py-4 transition-colors hover:bg-muted/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            onClick={() => openCompany(company.id)}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
              {company.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
                {!archived && <StatusBadge tone={statusTone[status]}>{statusLabel[status]}</StatusBadge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{industryLabel(company.industry)}</span>
                {company.businessModel && <span>{businessModelLabel(company.businessModel)}</span>}
                <span>{t('dashboard.lifecycle.grossMargin', { value: company.grossMargin })}</span>
                {!archived && summary && (
                  <span>
                    {t('dashboard.table.revenueFact')}: {fmtRub(summary.latestRevenue)} ·{' '}
                    {t('dashboard.table.taskProgress')}:{' '}
                    {summary.taskProgress != null ? `${summary.taskProgress}%` : '—'}
                  </span>
                )}
              </div>
            </div>
          </button>

          <div className="flex shrink-0 flex-wrap gap-2">
            {!archived && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={(event) => {
                  event.stopPropagation()
                  archiveMutation.mutate(company.id)
                }}
              >
                <Archive />
                {t('dashboard.lifecycle.archive')}
              </Button>
            )}
            {archived && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={(event) => {
                  event.stopPropagation()
                  restoreMutation.mutate(company.id)
                }}
              >
                <RotateCcw />
                {t('dashboard.lifecycle.restore')}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={isMutating}
              onClick={(event) => {
                event.stopPropagation()
                setPendingDeleteId(company.id)
              }}
            >
              <Trash2 />
              {t('dashboard.lifecycle.delete')}
            </Button>
          </div>
        </div>

        {isDeletePending && (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-danger/30 bg-danger/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-danger">{t('dashboard.lifecycle.deleteConfirm')}</p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDeleteId(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(company.id)}
              >
                {t('dashboard.lifecycle.confirmDelete')}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const activeCompanies = activeQuery.data ?? []
  const archivedCompanies = archivedQuery.data ?? []

  return (
    <div className="space-y-4">
      <Section
        title={t('dashboard.lifecycle.activeTitle')}
        actions={
          <span className="text-sm text-muted-foreground tabular-nums">{activeCompanies.length}</span>
        }
        className="[&>div:last-child]:p-0"
      >
        {activeQuery.isLoading && (
          <p className="px-5 py-4 text-sm text-muted-foreground">{t('dashboard.lifecycle.loading')}</p>
        )}
        {activeQuery.error && (
          <p className="px-5 py-4 text-sm text-destructive">{t('dashboard.lifecycle.loadError')}</p>
        )}
        {!activeQuery.isLoading && !activeQuery.error && activeCompanies.length === 0 && (
          <p className="px-5 py-4 text-center text-sm text-muted-foreground">
            {t('dashboard.lifecycle.activeEmpty')}
          </p>
        )}
        {activeCompanies.length > 0 && (
          <div className="divide-y divide-border/60">
            {activeCompanies.map((company) => renderCompany(company, false))}
          </div>
        )}
      </Section>

      <Section
        title={t('dashboard.lifecycle.archiveTitle')}
        actions={
          <span className="text-sm text-muted-foreground tabular-nums">{archivedCompanies.length}</span>
        }
        className="[&>div:last-child]:p-0"
      >
        {archivedQuery.isLoading && (
          <p className="px-5 py-4 text-sm text-muted-foreground">{t('dashboard.lifecycle.loading')}</p>
        )}
        {archivedQuery.error && (
          <p className="px-5 py-4 text-sm text-destructive">{t('dashboard.lifecycle.loadError')}</p>
        )}
        {!archivedQuery.isLoading && !archivedQuery.error && archivedCompanies.length === 0 && (
          <p className="px-5 py-4 text-center text-sm text-muted-foreground">
            {t('dashboard.lifecycle.archiveEmpty')}
          </p>
        )}
        {archivedCompanies.length > 0 && (
          <div className="divide-y divide-border/60">
            {archivedCompanies.map((company) => renderCompany(company, true))}
          </div>
        )}
      </Section>
    </div>
  )
}
