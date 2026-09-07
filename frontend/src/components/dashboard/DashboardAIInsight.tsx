import { useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { companiesApi } from '@/api/companies'
import type { InsightResponse } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, Plus, ArrowRight } from 'lucide-react'

export function DashboardAIInsight({
  companyId,
  onCreateTask,
  onOpenTasks,
}: {
  companyId: string
  onCreateTask: (title: string, description: string) => void
  onOpenTasks: () => void
}) {
  const { t } = useTranslation()
  const [result, setResult] = useState<InsightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestSeq = useRef(0)

  useEffect(() => {
    requestSeq.current += 1
    setResult(null)
    setError('')
    setLoading(false)
  }, [companyId])

  const providerLabel = (p: string) =>
    p === 'deepseek' ? 'DeepSeek' : p === 'gigachat' ? 'GigaChat' : t('company.providerDemo')

  const handleAnalyze = async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const insight = await companiesApi.insight(companyId, 'overview')
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

  const handleCreateTask = () => {
    if (!result) return
    onCreateTask(t('overview.ai.taskTitle'), result.text)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {loading ? t('common.analyzing') : t('overview.ai.analyze')}
        </Button>
        {result && <Badge variant="outline">{providerLabel(result.provider)}</Badge>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="whitespace-pre-wrap text-sm text-foreground">{result.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onOpenTasks}>
              {t('overview.ai.details')}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={handleCreateTask}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('overview.ai.createTask')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
