import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { companiesApi } from '@/api/companies'
import type { InsightScenario, InsightResponse } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2 } from 'lucide-react'

interface AIInsightProps {
  companyId: string
  scenario: InsightScenario
  initialResult?: InsightResponse | null
  onResult?: (result: InsightResponse) => void
}

export function AIInsight({ companyId, scenario, initialResult, onResult }: AIInsightProps) {
  const { t } = useTranslation()
  const [result, setResult] = useState<InsightResponse | null>(initialResult ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Stale-response guard: a response from a previous company/scenario must never populate state.
  const requestSeq = useRef(0)
  const inFlight = useRef(false)

  const providerLabel = (p: string) =>
    p === 'deepseek' ? 'DeepSeek' : p === 'gigachat' ? 'GigaChat' : t('company.providerDemo')

  useEffect(() => {
    requestSeq.current += 1
    setResult(initialResult ?? null)
    setError('')
    setLoading(false)
    inFlight.current = false
    return () => { requestSeq.current += 1 }
  }, [companyId, scenario, initialResult])

  const handleAnalyze = async () => {
    if (inFlight.current) return
    inFlight.current = true
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    try {
      const insight = await companiesApi.insight(companyId, scenario)
      if (seq !== requestSeq.current) return
      setResult(insight)
      onResult?.(insight)
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setError(typeof detail === 'string' && detail.trim() ? detail : t('company.ai.error'))
    } finally {
      if (seq === requestSeq.current) { inFlight.current = false; setLoading(false) }
    }
  }

  return (
    <div className="min-w-0 space-y-3" aria-busy={loading}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleAnalyze} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {loading ? t('common.analyzing') : error ? t('common.retry') : t('company.ai.analyze')}
        </Button>
        {result && <Badge variant="outline">{providerLabel(result.provider)}</Badge>}
      </div>

      {loading && <p role="status" className="text-sm text-muted-foreground">{t(result ? 'company.ai.refreshing' : 'common.analyzing')}</p>}
      {error && <p role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{error}</p>}

      {result && (
        <div className="min-w-0 text-sm text-foreground bg-muted/40 border border-border rounded-lg p-4">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{result.text}</p>
        </div>
      )}
    </div>
  )
}
