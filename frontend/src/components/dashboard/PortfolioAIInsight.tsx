import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles } from 'lucide-react'
import { portfolioInsightsApi } from '@/api/portfolioInsights'
import { useAuthStore } from '@/store/authStore'
import { canViewPortfolio } from '@/lib/navigation'
import { dashboardFilterKey, normalizeDashboardFilters } from '@/lib/dashboardFilters'
import type { DashboardFilters, PortfolioInsightResponse } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/shared/section'

export function PortfolioAIInsight({ filters }: { filters?: DashboardFilters }) {
  const { user } = useAuthStore()
  if (!canViewPortfolio(user)) return null
  // A keyed session clears both visible output and pending requests synchronously
  // on scope/tenant changes. Reordered equivalent selections retain the result.
  const identity = [user?.organizationId ?? user?.id, ...dashboardFilterKey(filters)]
  return <PortfolioInsightSession key={JSON.stringify(identity)} filters={normalizeDashboardFilters(filters)} />
}

function PortfolioInsightSession({ filters }: { filters: DashboardFilters }) {
  const { t } = useTranslation()
  const [result, setResult] = useState<PortfolioInsightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const inFlight = useRef(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])

  const generate = async () => {
    if (inFlight.current) return
    inFlight.current = true
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(false)
    try {
      const response = await portfolioInsightsApi.generate(filters, controller.signal)
      if (!controller.signal.aborted) setResult(response)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) {
        inFlight.current = false
        setLoading(false)
      }
    }
  }
  const providerLabel = result?.provider === 'deepseek' ? 'DeepSeek' : result?.provider === 'gigachat' ? 'GigaChat' : t('company.providerDemo')

  return <Section title={t('portfolioAi.title')} description={t('portfolioAi.description')}>
    <div className="min-w-0 space-y-3" aria-busy={loading}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={generate}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />}
          {loading ? t('common.analyzing') : error ? t('common.retry') : t('company.ai.analyze')}
        </Button>
        {result && <Badge variant="outline">{providerLabel}</Badge>}
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">{t(result ? 'company.ai.refreshing' : 'common.analyzing')}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{t('portfolioAi.error')}</p>}
      {result && <div className="min-w-0 rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{result.text}</p>
      </div>}
    </div>
  </Section>
}
