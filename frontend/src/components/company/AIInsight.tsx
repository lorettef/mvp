import { useState } from 'react'
import { AxiosError } from 'axios'
import { companiesApi } from '@/api/companies'
import type { InsightScenario, InsightResponse } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2 } from 'lucide-react'

const providerLabel = (p: string) =>
  p === 'deepseek' ? 'DeepSeek' : p === 'gigachat' ? 'GigaChat' : 'демо-режим'

interface AIInsightProps {
  companyId: string
  scenario: InsightScenario
}

export function AIInsight({ companyId, scenario }: AIInsightProps) {
  const [result, setResult] = useState<InsightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      setResult(await companiesApi.insight(companyId, scenario))
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr.response?.data?.detail || 'Ошибка AI-анализа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {loading ? 'Анализ...' : 'AI-анализ модуля'}
        </Button>
        {result && <Badge variant="outline">{providerLabel(result.provider)}</Badge>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="text-sm text-foreground bg-muted/40 border border-border rounded-lg p-4">
          <p className="whitespace-pre-wrap">{result.text}</p>
        </div>
      )}
    </div>
  )
}
