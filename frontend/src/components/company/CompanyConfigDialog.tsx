import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { catalogApi } from '@/api/catalog'
import { companiesApi } from '@/api/companies'
import type { CatalogResponse, Company, MetricProfile } from '@/types/api'
import { qk } from '@/lib/queryKeys'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CompanyConfigDialogProps {
  readonly open: boolean
  readonly company: Company | null
  readonly tenantKey: string
  readonly onOpenChange: (open: boolean) => void
}

export function CompanyConfigDialog({ open, company, tenantKey, onOpenChange }: CompanyConfigDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [geography, setGeography] = useState('')
  const [industry, setIndustry] = useState('')
  const [businessModel, setBusinessModel] = useState('')
  const [grossMargin, setGrossMargin] = useState('')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])

  const catalogQuery = useQuery<CatalogResponse>({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
    enabled: open,
  })

  useEffect(() => {
    if (!open || !company) return
    setName(company.name)
    setGeography(company.geography ?? '')
    setIndustry(company.industry ?? '')
    setBusinessModel(company.businessModel ?? '')
    setGrossMargin(company.grossMargin != null ? String(Math.round(company.grossMargin * 10000) / 100) : '')
    setSelectedMetrics(company.selectedMetrics ?? [])
  }, [open, company])

  const REGIONS = [
    { label: t('common.geo.ru') },
    { label: t('common.geo.kz') },
    { label: t('common.geo.global') },
  ]

  const catalog = catalogQuery.data
  const profile: MetricProfile | undefined = catalog?.profiles[industry]?.[businessModel]
  const availableBusinessModels = catalog && industry
    ? Object.keys(catalog.profiles[industry] ?? {})
        .map((slug) => catalog.business_models.find((item) => item.slug === slug))
        .filter((item): item is NonNullable<typeof item> => item !== undefined)
    : []

  const defaultChecked = (key: string) =>
    selectedMetrics.length === 0 ? true : selectedMetrics.includes(key)

  const toggleMetric = (key: string) => {
    setSelectedMetrics((current) => {
      if (current.length === 0) {
        const all = profile?.metrics.map((m) => m.key) ?? []
        return all.filter((item) => item !== key)
      }
      return current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    })
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!company) return Promise.reject(new Error('no company'))
      const gross = Number(grossMargin)
      return companiesApi.update(company.id, {
        name: name.trim(),
        geography,
        industry: industry || undefined,
        business_model: businessModel || undefined,
        gross_margin: Number.isFinite(gross) && gross >= 0 && gross <= 100 ? gross / 100 : undefined,
        selected_metrics: selectedMetrics,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, company?.id ?? '') })
      void queryClient.invalidateQueries({ queryKey: qk.companies(tenantKey, false) })
      onOpenChange(false)
    },
  })

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg outline-none">
          <div className="flex flex-col space-y-1.5">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {t('dashboard.config.title')}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {t('dashboard.config.description')}
            </DialogPrimitive.Description>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label htmlFor="config-name" className="text-sm font-medium text-foreground">
                {t('dashboard.companyName')}
              </label>
              <Input id="config-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('dashboard.onboarding.location')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('dashboard.onboarding.location')}>
                {REGIONS.map((region) => {
                  const selected = geography === region.label
                  return (
                    <button
                      key={region.label}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setGeography(region.label)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input bg-card hover:border-primary/50 hover:bg-accent'
                      }`}
                    >
                      {region.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('dashboard.sphere')}</label>
              {catalogQuery.isLoading && <p className="text-sm text-muted-foreground">{t('dashboard.onboarding.catalogLoading')}</p>}
              {catalog && (
                <Select
                  value={industry}
                  onValueChange={(value) => {
                    setIndustry(value)
                    setBusinessModel('')
                  }}
                >
                  <SelectTrigger aria-label={t('dashboard.sphere')}>
                    <SelectValue placeholder={t('dashboard.selectSphere')} />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.industries.map((item) => (
                      <SelectItem key={item.slug} value={item.slug}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('dashboard.onboarding.businessModelLabel')}</label>
              {availableBusinessModels.length > 0 ? (
                <Select
                  value={businessModel}
                  onValueChange={(value) => {
                    setBusinessModel(value)
                    const prof = catalog?.profiles[industry]?.[value]
                    if (prof) {
                      const recommended = prof.metrics.map((m) => m.key)
                      setSelectedMetrics((current) =>
                        current.length === 0 ? recommended : Array.from(new Set([...current, ...recommended])),
                      )
                    }
                  }}
                >
                  <SelectTrigger aria-label={t('dashboard.onboarding.businessModelLabel')}>
                    <SelectValue placeholder={t('dashboard.onboarding.selectBusinessModel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBusinessModels.map((item) => (
                      <SelectItem key={item.slug} value={item.slug}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {t('dashboard.onboarding.noBusinessModels')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('dashboard.onboarding.recommendedTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('dashboard.onboarding.selectMetricsHint')}</p>
              {profile && (
                <ul className="space-y-2">
                  {profile.metrics.map((metric) => {
                    const checked = defaultChecked(metric.key)
                    return (
                      <li key={metric.key}>
                        <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${checked ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4"
                            checked={checked}
                            onChange={() => toggleMetric(metric.key)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{metric.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{metric.why}</p>
                          </div>
                          {metric.required && <Badge variant="secondary">{t('dashboard.onboarding.required')}</Badge>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                {t('dashboard.onboarding.selectedCount', { count: selectedMetrics.length })}
                {profile && profile.derived.length > 0 && ` · ${t('dashboard.onboarding.derivedNote')}`}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="config-gross-margin" className="text-sm font-medium text-foreground">
                {t('dashboard.onboarding.grossMargin')}
              </label>
              <Input
                id="config-gross-margin"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={grossMargin}
                onChange={(e) => setGrossMargin(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={name.trim() === '' || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>

          <DialogPrimitive.Close asChild>
            <button
              type="button"
              aria-label={t('common.cancel')}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
