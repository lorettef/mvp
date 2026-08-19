import { useState } from 'react'
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
  { value: 'other', label: 'Другое' },
]

const GEOGRAPHIES: { value: MarketGeography; label: string }[] = [
  { value: 'RU', label: 'Россия' },
  { value: 'KZ', label: 'Казахстан' },
  { value: 'global', label: 'Глобальный рынок' },
]

const fmtMarket = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')} млрд`

const fmtFactor = (v: number) => `×${v.toFixed(3)}`

interface MarketTabProps {
  data: MarketAnalysisResponse | null
  isLoading: boolean
  onAnalyze: (req: MarketAnalysisRequest) => void
}

export function MarketTab({ data, isLoading, onAnalyze }: MarketTabProps) {
  const [form, setForm] = useState({
    industry: 'saas' as MarketIndustry,
    geography: 'RU' as MarketGeography,
    horizon: 3,
  })

  const handleAnalyze = () => onAnalyze({ ...form })

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Внешний анализ рынка</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Сфера деятельности</label>
              <select
                aria-label="Сфера деятельности"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value as MarketIndustry })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {INDUSTRIES.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">География</label>
              <select
                aria-label="География"
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
              <label className="text-xs text-muted-foreground block mb-1">Горизонт</label>
              <select
                aria-label="Горизонт"
                value={form.horizon}
                onChange={(e) => setForm({ ...form, horizon: Number(e.target.value) })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {[1, 2, 3].map((h) => (
                  <option key={h} value={h}>
                    {h} год(а)
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" className="w-full" disabled={isLoading} onClick={handleAnalyze}>
              {isLoading ? 'Анализ...' : 'Анализировать'}
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
                <h3 className="font-semibold text-foreground mb-4">Макроэкономика</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Рост ВВП</dt>
                    <dd className="text-foreground">+{data.macro.gdpGrowth.toFixed(1)}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Инфляция</dt>
                    <dd className="text-foreground">{data.macro.inflation.toFixed(1)}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Ключевая ставка</dt>
                    <dd className="text-foreground">{data.macro.keyRate.toFixed(1)}%</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="border bg-card/50">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-4">Объём рынка ({data.industryLabel})</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Сейчас</dt>
                    <dd className="text-foreground">{fmtMarket(data.marketSize)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Через {data.horizon} г.</dt>
                    <dd className="text-foreground">{fmtMarket(data.marketSizeProjected)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Рост</dt>
                    <dd className="text-foreground">{data.marketGrowth.toFixed(0)}%/год</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="border bg-card/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-foreground mb-4">Влияние на метрики</h3>
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
              <h3 className="font-semibold text-foreground mb-4">Тренды</h3>
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
