import { useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { companiesApi } from '@/api/companies'
import type { InsightScenario, InsightResponse } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2 } from 'lucide-react'

interface AIInsightProps {
  companyId: string
  scenario: InsightScenario
}

export function AIInsight({ companyId, scenario }: AIInsightProps) {
  const { t } = useTranslation()
  const [result, setResult] = useState<InsightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Stale-response guard: a response from a previous company/scenario must never populate state.
  const requestSeq = useRef(0)

  const providerLabel = (p: string) =>
    p === 'deepseek' ? 'DeepSeek' : p === 'gigachat' ? 'GigaChat' : t('company.providerDemo')

  useEffect(() => {
    requestSeq.current += 1
    setResult(null)
    setError('')
    setLoading(false)
  }, [companyId, scenario])

  const handleAnalyze = async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const insight = await companiesApi.insight(companyId, scenario)
      if (seq !== requestSeq.current) return
      setResult(insight)
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr.response?.data?.detail || t('company.ai.error'))
    } finally {
      if (seq === requestSeq.current) setLoading(false)
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
          {loading ? t('common.analyzing') : t('company.ai.analyze')}
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
