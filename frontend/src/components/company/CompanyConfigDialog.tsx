import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { catalogApi } from '@/api/catalog'
import { companiesApi } from '@/api/companies'
import type { CatalogResponse, Company, MetricProfile } from '@/types/api'
import { qk } from '@/lib/queryKeys'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto" closeLabel={t('common.cancel')}>
        <DialogHeader>
          <DialogTitle>{t('dashboard.config.title')}</DialogTitle>
          <DialogDescription>{t('dashboard.config.description')}</DialogDescription>
        </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label htmlFor="config-name" className="text-sm font-medium text-foreground">
                {t('dashboard.companyName')}
              </label>
              <Input id="config-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('dashboard.onboarding.location')}</p>
              <RadioGroup value={geography} onValueChange={setGeography} aria-label={t('dashboard.onboarding.location')} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {REGIONS.map((region) => (
                  <RadioGroupItem
                    key={region.label}
                    value={region.label}
                    className="flex aspect-auto h-auto w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent data-[state=checked]:border-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-foreground data-[state=unchecked]:border-input data-[state=unchecked]:bg-card"
                  >
                    {region.label}
                  </RadioGroupItem>
                ))}
              </RadioGroup>
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
                          <Checkbox
                            className="mt-0.5"
                            checked={checked}
                            onCheckedChange={() => toggleMetric(metric.key)}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={name.trim() === '' || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
