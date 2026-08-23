import React, { useState } from 'react'
import { AxiosError } from 'axios'
import { recommendationsApi } from '../api/recommendations'
import { RecommendationAction, RecommendationResponse } from '@/types/api'
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

export const Recommendations = () => {
  const [metrics, setMetrics] = useState({
    mrr: 50000,
    cac: 5000,
    ltv: 15000,
    churn: 0.05,
    arpu: 1500,
    runway_months: 18,
    stage: 'pre_seed',
  })

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecommendationResponse | null>(null)
  const [error, setError] = useState('')

  const handleGetRecommendations = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await recommendationsApi.get({
        metrics,
      })
      setResult(response)
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr.response?.data?.detail || 'Ошибка получения рекомендаций')
    } finally {
      setLoading(false)
    }
  }

  const priorityVariant = {
    high: 'destructive' as const,
    medium: 'default' as const,
    low: 'secondary' as const,
  }

  const priorityLabels = {
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
  }

  const providerLabels: Record<string, string> = {
    deepseek: 'AI (DeepSeek)',
    gigachat: 'AI (GigaChat)',
    demo: 'Базовая рекомендация',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Smart-рекомендации</h1>
        <p className="text-muted-foreground">
          Персонализированные рекомендации на основе ваших метрик
        </p>
      </div>

      {/* Форма ввода метрик */}
      <Card className="border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Введите текущие метрики</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">MRR ($)</label>
              <Input
                type="number"
                value={metrics.mrr}
                onChange={(e) => setMetrics({ ...metrics, mrr: Number(e.target.value) })}
                className="bg-card border-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">CAC ($)</label>
              <Input
                type="number"
                value={metrics.cac}
                onChange={(e) => setMetrics({ ...metrics, cac: Number(e.target.value) })}
                className="bg-card border-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">LTV ($)</label>
              <Input
                type="number"
                value={metrics.ltv}
                onChange={(e) => setMetrics({ ...metrics, ltv: Number(e.target.value) })}
                className="bg-card border-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Churn (%)</label>
              <Input
                type="number"
                step="0.01"
                value={metrics.churn * 100}
                onChange={(e) => setMetrics({ ...metrics, churn: Number(e.target.value) / 100 })}
                className="bg-card border-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">ARPU ($)</label>
              <Input
                type="number"
                value={metrics.arpu}
                onChange={(e) => setMetrics({ ...metrics, arpu: Number(e.target.value) })}
                className="bg-card border-input"
              />
            </div>
            <div>
<label className="block text-sm font-medium text-muted-foreground mb-1">Runway (мес.)</label>
              <Input
                type="number"
                value={metrics.runway_months}
                onChange={(e) => setMetrics({ ...metrics, runway_months: Number(e.target.value) })}
                className="bg-card border-input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Стадия</label>
              <Select
                value={metrics.stage}
                onValueChange={(value) => setMetrics({ ...metrics, stage: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите стадию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_seed">Pre-seed</SelectItem>
                  <SelectItem value="seed">Seed</SelectItem>
                  <SelectItem value="series_a">Series A</SelectItem>
                  <SelectItem value="series_b">Series B</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full mt-4"
            onClick={handleGetRecommendations}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Получение рекомендаций...
              </>
            ) : (
              <>
                <Sparkles />
                Получить рекомендации
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Результат */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-destructive text-sm">{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Сводка */}
          <Card className="bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary-800">Анализ</p>
                    <Badge variant="outline">
                      {providerLabels[result.provider] ?? 'Базовая рекомендация'}
                    </Badge>
                  </div>
                  <p className="text-sm text-primary-700 mt-1">{result.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Рекомендации */}
          <div className="space-y-3">
            {result.recommendations && result.recommendations.map((rec: RecommendationAction, i: number) => (
              <Card key={i} className="border hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={priorityVariant[rec.priority as keyof typeof priorityVariant]}>
                          {priorityLabels[rec.priority as keyof typeof priorityLabels]}
                        </Badge>
                        <Badge variant="outline">
                          {rec.category}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-foreground">{rec.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {result.raw_response && (
            <div className="text-xs text-muted-foreground bg-card p-3 rounded-lg border border">
              <details>
                <summary className="cursor-pointer">Техническая информация</summary>
                <p className="mt-2 whitespace-pre-wrap">{result.raw_response}</p>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
