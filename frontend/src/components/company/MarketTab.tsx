import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  MarketAnalysisRequest,
  MarketAnalysisResponse,
  MarketIndustry,
  MarketGeography,
} from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const INDUSTRIES: { value: MarketIndustry; label: string }[] = [
  { value: 'saas', label: 'SaaS' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'edtech', label: 'EdTech' },
  { value: 'healthtech', label: 'HealthTech' },
  { value: 'ai', label: 'AI/ML' },
  { value: 'marketplaces', label: 'Маркетплейсы' },
  { value: 'foodtech', label: 'FoodTech' },
  { value: 'logistics', label: 'Логистика' },
  { value: 'proptech', label: 'PropTech' },
  { value: 'media', label: 'Медиа и развлечения' },
  { value: 'hardware', label: 'Hardware / IoT' },
  { value: 'biotech', label: 'Biotech' },
  { value: 'cleantech', label: 'CleanTech' },
]

const fmtFactor = (v: number) => `×${v.toFixed(3)}`

interface MarketTabProps {
  data: MarketAnalysisResponse | null
  isLoading: boolean
  onAnalyze: (req: MarketAnalysisRequest) => void
}

export function MarketTab({ data, isLoading, onAnalyze }: MarketTabProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    industry: 'saas' as MarketIndustry,
    geography: 'RU' as MarketGeography,
    horizon: 3,
  })

  const fmtMarket = (v: number | null | undefined) =>
    v == null ? '—' : t('company.market.marketValue', { value: v.toLocaleString('ru-RU') })

  const INDUSTRIES_FULL: { value: MarketIndustry; label: string }[] = [
    ...INDUSTRIES,
    { value: 'other', label: t('common.other') },
  ]

  const GEOGRAPHIES: { value: MarketGeography; label: string }[] = [
    { value: 'RU', label: t('common.geo.ru') },
    { value: 'KZ', label: t('common.geo.kz') },
    { value: 'global', label: t('common.geo.global') },
  ]

  const handleAnalyze = () => onAnalyze({ ...form })

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">{t('company.market.title')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('company.market.sphere')}</label>
              <select
                aria-label={t('company.market.sphere')}
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value as MarketIndustry })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {INDUSTRIES_FULL.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('company.market.geography')}</label>
              <select
                aria-label={t('company.market.geography')}
                value={form.geography}
                onChange={(e) => setForm({ ...form, geography: e.target.value as MarketGeography })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {GEOGRAPHIES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('company.market.horizon')}</label>
              <select
                aria-label={t('company.market.horizon')}
                value={form.horizon}
                onChange={(e) => setForm({ ...form, horizon: Number(e.target.value) })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {[1, 2, 3].map((h) => (
                  <option key={h} value={h}>
                    {t('company.market.years', { count: h })}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" className="w-full" disabled={isLoading} onClick={handleAnalyze}>
              {isLoading ? t('common.analyzing') : t('company.market.analyze')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border bg-card/50">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-4">{t('company.market.macro')}</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('company.market.gdpGrowth')}</dt>
                    <dd className="text-foreground">+{data.macro.gdpGrowth.toFixed(1)}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('company.market.inflation')}</dt>
                    <dd className="text-foreground">{data.macro.inflation.toFixed(1)}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('company.market.keyRate')}</dt>
                    <dd className="text-foreground">{data.macro.keyRate.toFixed(1)}%</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="border bg-card/50">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-4">
                  {t('company.market.marketSize', { industry: data.industryLabel })}
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('company.market.now')}</dt>
                    <dd className="text-foreground">{fmtMarket(data.marketSize)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('company.market.inYears', { count: data.horizon })}</dt>
                    <dd className="text-foreground">{fmtMarket(data.marketSizeProjected)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('company.market.growth')}</dt>
                    <dd className="text-foreground">{t('company.market.growthPerYear', { value: data.marketGrowth.toFixed(0) })}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="border bg-card/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-foreground mb-4">{t('company.market.impact')}</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">MRR</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {fmtFactor(data.impact.mrrFactor)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">CAC</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {fmtFactor(data.impact.cacFactor)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Churn</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {fmtFactor(data.impact.churnFactor)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">{data.summary}</p>
            </CardContent>
          </Card>

          <Card className="border bg-card/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-foreground mb-4">{t('company.market.trends')}</h3>
              <ul className="space-y-2 text-sm">
                {data.trends.map((t) => (
                  <li key={t} className="text-foreground">
                    • {t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
