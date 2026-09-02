import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { forecastApi } from '../api/forecast'
import { analytics } from '../api/analytics'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ForecastResponse } from '@/types/api'
import { TrendingUp, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

export const Forecast = () => {
  const { t } = useTranslation()
  const [historyInput, setHistoryInput] = useState('50000, 52000, 54000, 58000, 60000, 65000')
  const [months, setMonths] = useState(6)
  const [method, setMethod] = useState<'linear' | 'polynomial' | 'prophet'>('polynomial')
  const [result, setResult] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePredict = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const history = historyInput.split(',').map((s) => parseFloat(s.trim()))
      if (history.some(isNaN)) {
        throw new Error(t('forecast.invalidHistory'))
      }

      const response = await forecastApi.predict({ history, months, method })
      setResult(response)
      analytics.track('forecast_requested')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('forecast.error'))
    } finally {
      setLoading(false)
    }
  }

  const prepareChartData = () => {
    if (!result) return []

    const history = historyInput.split(',').map((s) => parseFloat(s.trim()))
    const ci = result.confidenceInterval

    const data: {
      month: string
      historical: number | null
      forecast: number | null
      confidenceUpper: number | null
      confidenceLower: number | null
      confidenceBand: number | null
    }[] = history.map((value, i) => ({
      month: t('forecast.month', { n: i + 1 }),
      historical: value,
      forecast: null,
      confidenceUpper: null,
      confidenceLower: null,
      confidenceBand: null,
    }))

    result.predictions.forEach((value: number, i: number) => {
      const upper = ci ? ci.upper[i] : null
      const lower = ci ? ci.lower[i] : null
      data.push({
        month: t('forecast.month', { n: history.length + i + 1 }),
        historical: null,
        forecast: value,
        confidenceUpper: upper,
        confidenceLower: lower,
        confidenceBand: upper != null && lower != null ? +(upper - lower).toFixed(2) : null,
      })
    })

    return data
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('forecast.title')}</h1>
        <p className="text-muted-foreground">
          {t('forecast.subtitle')}
        </p>
      </div>

      <Card className="border">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('forecast.history')}
              </label>
              <Input
                type="text"
                value={historyInput}
                onChange={(e) => setHistoryInput(e.target.value)}
                placeholder="50000, 52000, 54000, 58000, 60000, 65000"
                className="bg-card border-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('forecast.historyHint')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('forecast.months')}
                </label>
                <Input
                  type="number"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  min={1}
                  max={24}
                  className="bg-card border-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('forecast.method')}
                </label>
                <Select
                  value={method}
                  onValueChange={(value) => setMethod(value as 'linear' | 'polynomial' | 'prophet')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('forecast.selectMethod')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="polynomial">{t('forecast.polynomial')}</SelectItem>
                    <SelectItem value="linear">{t('forecast.linear')}</SelectItem>
                    <SelectItem value="prophet">{t('forecast.prophet')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handlePredict}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t('forecast.building')}
                </>
              ) : (
                <>
                  <TrendingUp />
                  {t('forecast.build')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-destructive text-sm">{error}</div>
        </div>
      )}

      {result && (
        <Card className="border">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-4">{t('forecast.result')}</h3>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={prepareChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `₽${(v / 1000).toFixed(0)}k`} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="historical"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name={t('forecast.historical')}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name={t('forecast.forecast')}
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="confidenceLower"
                    stackId="confidence"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="confidenceBand"
                    stackId="confidence"
                    stroke="none"
                    fill="#10b981"
                    fillOpacity={0.12}
                    name={t('forecast.confidence')}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4">
              <Card className="border bg-card/50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    {t('forecast.firstForecastMonth', { n: historyInput.split(',').length + 1 })}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {result.predictions?.length > 0 ? `₽${result.predictions[0].toFixed(0)}` : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border bg-card/50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('forecast.avgGrowth')}</p>
                  <p className="text-lg font-bold text-green-400">
                    +{(Math.pow(result.predictions[result.predictions.length - 1] / parseFloat(historyInput.split(',').shift() || '1'), 1 / (historyInput.split(',').length + result.predictions.length - 1)) * 100 - 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card className="border bg-card/50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('forecast.method')}</p>
                  <p className="text-lg font-bold text-foreground capitalize">
                    {result.method}
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
