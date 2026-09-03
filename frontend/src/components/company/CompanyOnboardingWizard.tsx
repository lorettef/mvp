import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { catalogApi } from '@/api/catalog'
import { companiesApi } from '@/api/companies'
import type { BusinessModelItem, CatalogResponse, CompanyCreate, IndustryItem, MetricProfile } from '@/types/api'
import { qk } from '@/lib/queryKeys'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CompanyOnboardingWizardProps {
  readonly open: boolean
  readonly tenantKey: string
  readonly onClose: () => void
}

type OnboardingPayload = Pick<CompanyCreate, 'name' | 'industry' | 'business_model' | 'gross_margin' | 'geography'>

const WIZARD_STEPS = 4

export function CompanyOnboardingWizard({ open, tenantKey, onClose }: CompanyOnboardingWizardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [geography, setGeography] = useState('')
  const [industry, setIndustry] = useState('')
  const [businessModel, setBusinessModel] = useState('')
  const [grossMargin, setGrossMargin] = useState('')

  const REGIONS = [
    { label: t('common.geo.ru'), rate: '21' },
    { label: t('common.geo.kz'), rate: '16' },
    { label: t('common.geo.global'), rate: '4' },
  ]

  const catalogQuery = useQuery<CatalogResponse>({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
  })

  const createMutation = useMutation({
    mutationFn: (payload: OnboardingPayload) => companiesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.dashboard(tenantKey) })
      onClose()
    },
  })

  if (!open) return null

  const catalog = catalogQuery.data
  const selectedIndustry: IndustryItem | undefined = catalog?.industries.find((item) => item.slug === industry)
  const selectedBusinessModel: BusinessModelItem | undefined = catalog?.businessModels.find(
    (item) => item.slug === businessModel,
  )
  const availableBusinessModels = catalog && industry
    ? Object.keys(catalog.profiles[industry] ?? {})
        .map((slug) => catalog.businessModels.find((item) => item.slug === slug))
        .filter((item): item is BusinessModelItem => item !== undefined)
    : []
  const profile: MetricProfile | undefined = catalog?.profiles[industry]?.[businessModel]
  const grossMarginValue = Number(grossMargin)
  const hasValidGrossMargin = grossMargin.trim() !== '' && Number.isFinite(grossMarginValue) && grossMarginValue >= 0 && grossMarginValue <= 100
  const canContinue = step === 1
    ? name.trim() !== ''
    : step === 2
      ? industry !== ''
      : step === 3
        ? businessModel !== '' && profile !== undefined
        : hasValidGrossMargin && profile !== undefined

  const reset = () => {
    setStep(1)
    setName('')
    setGeography('')
    setIndustry('')
    setBusinessModel('')
    setGrossMargin('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const submit = () => {
    if (!canContinue || !profile || !industry || !businessModel) return
    createMutation.mutate({
      name: name.trim(),
      geography,
      industry,
      business_model: businessModel,
      gross_margin: grossMarginValue,
    })
  }

  const stepLabels = [
    t('dashboard.onboarding.steps.name'),
    t('dashboard.onboarding.steps.industry'),
    t('dashboard.onboarding.steps.businessModel'),
    t('dashboard.onboarding.steps.metrics'),
  ]

  return (
    <Card className="border bg-card/50">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('dashboard.onboarding.title')}</CardTitle>
            <CardDescription className="mt-2">{t('dashboard.onboarding.description')}</CardDescription>
          </div>
          <span className="text-sm text-muted-foreground">
            {t('dashboard.onboarding.stepCounter', { current: step, total: WIZARD_STEPS })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4" aria-label={t('dashboard.onboarding.progressLabel')}>
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1
            return (
              <div key={label} className="space-y-2">
                <div className={`h-1 rounded-full ${stepNumber <= step ? 'bg-primary' : 'bg-muted'}`} />
                <span className={`block text-xs ${stepNumber === step ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="onboarding-company-name" className="text-sm font-medium text-foreground">
                {t('dashboard.companyName')}
              </label>
              <Input
                id="onboarding-company-name"
                autoFocus
                placeholder={t('dashboard.companyName')}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('dashboard.onboarding.location')}</p>
              <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label={t('dashboard.onboarding.location')}>
                {REGIONS.map((region) => {
                  const isSelected = geography === region.label
                  return (
                    <button
                      key={region.label}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setGeography(region.label)}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input bg-card hover:border-primary/50 hover:bg-accent'
                      }`}
                    >
                      <span className="text-sm font-medium">{region.label}</span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {t('common.keyRateHint', { rate: region.rate })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <label htmlFor="onboarding-industry" className="text-sm font-medium text-foreground">
              {t('dashboard.sphere')}
            </label>
            {catalogQuery.isLoading && <p className="text-sm text-muted-foreground">{t('dashboard.onboarding.catalogLoading')}</p>}
            {catalogQuery.error && (
              <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <span>{t('dashboard.onboarding.catalogError')}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void catalogQuery.refetch()}>
                  {t('common.retry')}
                </Button>
              </div>
            )}
            {catalog && (
              <Select value={industry} onValueChange={(value) => {
                setIndustry(value)
                setBusinessModel('')
              }}>
                <SelectTrigger id="onboarding-industry" aria-label={t('dashboard.sphere')}>
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
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t('dashboard.onboarding.businessModelLabel')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.onboarding.businessModelHint')}</p>
            </div>
            {availableBusinessModels.length > 0 ? (
              <Select value={businessModel} onValueChange={setBusinessModel}>
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
            {selectedBusinessModel && <p className="text-sm text-muted-foreground">{selectedBusinessModel.description}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">{name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedIndustry?.label} · {selectedBusinessModel?.label}
              </p>
            </div>
            {profile ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t('dashboard.onboarding.recommendedTitle')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{profile.why}</p>
                </div>
                <ul className="space-y-2">
                  {profile.metrics.map((metric) => (
                    <li key={metric.key} className="flex items-start gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{metric.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{metric.why}</p>
                      </div>
                      {metric.required && <Badge variant="secondary">{t('dashboard.onboarding.required')}</Badge>}
                    </li>
                  ))}
                </ul>
                {profile.metrics.length === 0 && <p className="text-sm text-muted-foreground">{t('dashboard.onboarding.noMetrics')}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('dashboard.onboarding.noMetrics')}</p>
            )}
            <div className="space-y-2">
              <label htmlFor="onboarding-gross-margin" className="text-sm font-medium text-foreground">
                {t('dashboard.onboarding.grossMargin')}
              </label>
              <Input
                id="onboarding-gross-margin"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="70"
                value={grossMargin}
                onChange={(event) => setGrossMargin(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('dashboard.onboarding.grossMarginHint')}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={close}>{t('common.cancel')}</Button>
          <div className="flex gap-2">
            {step > 1 && <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>{t('dashboard.onboarding.back')}</Button>}
            {step < WIZARD_STEPS ? (
              <Button type="button" disabled={!canContinue || (step > 1 && catalogQuery.isLoading)} onClick={() => setStep((current) => current + 1)}>
                {t('dashboard.onboarding.next')}
              </Button>
            ) : (
              <Button type="button" disabled={!canContinue || createMutation.isPending} onClick={submit}>
                {createMutation.isPending ? t('dashboard.creating') : t('dashboard.create')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
