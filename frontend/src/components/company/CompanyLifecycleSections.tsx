import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'

import { companiesApi } from '@/api/companies'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtRub } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import type { Company, CompanyStatusItem } from '@/types/api'

interface CompanyLifecycleSectionsProps {
  readonly tenantKey: string
  readonly dashboardCompanies: readonly CompanyStatusItem[]
}

type Status = CompanyStatusItem['status']

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

  const statusMap: Record<Status, { label: string; className: string }> = {
    on_track: { label: t('dashboard.status.onTrack'), className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    behind: { label: t('dashboard.status.behind'), className: 'bg-destructive/10 text-destructive border-destructive/20' },
    no_plan: { label: t('dashboard.status.noPlan'), className: 'bg-muted text-muted-foreground border-border' },
    no_data: { label: t('dashboard.status.noData'), className: 'bg-muted text-muted-foreground border-border' },
  }
  const dashboardById = new Map(dashboardCompanies.map((company) => [company.id, company]))
  const isMutating = archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending

  const openCompany = (companyId: string) => navigate(`/companies/${companyId}`)

  const renderCompany = (company: Company, archived: boolean) => {
    const summary = dashboardById.get(company.id)
    const status = statusMap[summary?.status ?? 'no_data']
    const isDeletePending = pendingDeleteId === company.id

    return (
      <div key={company.id} className="rounded-lg border border-border/70 bg-card/40 p-4 transition-colors hover:bg-muted/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <button
            type="button"
            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            onClick={() => openCompany(company.id)}
          >
            <p className="truncate font-medium text-foreground">{company.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{company.industry ?? '—'}</span>
              {company.businessModel && <span>{company.businessModel}</span>}
              <span>{t('dashboard.lifecycle.grossMargin', { value: company.grossMargin })}</span>
              {!archived && <Badge className={status.className}>{status.label}</Badge>}
            </div>
            {!archived && summary && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('dashboard.table.revenueFact')}: {fmtRub(summary.latestRevenue)} · {t('dashboard.table.taskProgress')}: {summary.taskProgress != null ? `${summary.taskProgress}%` : '—'}
              </p>
            )}
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
              variant="destructive"
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
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{t('dashboard.lifecycle.deleteConfirm')}</p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDeleteId(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(company.id)}>
                {deleteMutation.isPending ? t('dashboard.lifecycle.processing') : t('dashboard.lifecycle.confirmDelete')}
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
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between gap-3 text-lg">
            <span>{t('dashboard.lifecycle.activeTitle')}</span>
            <span className="text-sm font-normal text-muted-foreground">{activeCompanies.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeQuery.isLoading && <p className="text-sm text-muted-foreground">{t('dashboard.lifecycle.loading')}</p>}
          {activeQuery.error && <p className="text-sm text-destructive">{t('dashboard.lifecycle.loadError')}</p>}
          {!activeQuery.isLoading && !activeQuery.error && activeCompanies.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('dashboard.lifecycle.activeEmpty')}</p>
          )}
          {activeCompanies.map((company) => renderCompany(company, false))}
        </CardContent>
      </Card>

      <Card className="border bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between gap-3 text-lg">
            <span>{t('dashboard.lifecycle.archiveTitle')}</span>
            <span className="text-sm font-normal text-muted-foreground">{archivedCompanies.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {archivedQuery.isLoading && <p className="text-sm text-muted-foreground">{t('dashboard.lifecycle.loading')}</p>}
          {archivedQuery.error && <p className="text-sm text-destructive">{t('dashboard.lifecycle.loadError')}</p>}
          {!archivedQuery.isLoading && !archivedQuery.error && archivedCompanies.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('dashboard.lifecycle.archiveEmpty')}</p>
          )}
          {archivedCompanies.map((company) => renderCompany(company, true))}
        </CardContent>
      </Card>
    </div>
  )
}
