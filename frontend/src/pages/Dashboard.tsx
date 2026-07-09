import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { metricsApi } from '../api/metrics'
import { useAuthStore } from '../store/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  Settings,
  RefreshCw,
  AlertCircle
} from 'lucide-react'

import { StatCard } from '@/components/common/StatCard'

export const Dashboard = () => {
  const { user } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)

  const loadMetrics = () => {
    try {
      const saved = localStorage.getItem('dashboard-metrics')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      mrr: 50000,
      cac: 5000,
      ltv: 15000,
      churn: 0.05,
      arpu: 1500,
      runway_months: 18,
      stage: 'pre_seed',
      active_users: 45,
    }
  }

  const [metrics, setMetrics] = useState(loadMetrics)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['metrics', metrics],
    queryFn: () => metricsApi.analyze(metrics),
    enabled: true,
    retry: 1,
  })

  const handleMetricChange = (field: string, value: number) => {
    setMetrics((prev: typeof metrics) => {
      const next = { ...prev, [field]: value }
      localStorage.setItem('dashboard-metrics', JSON.stringify(next))
      return next
    })
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background text-foreground">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">Ошибка загрузки данных</p>
          <p className="text-muted-foreground text-sm mt-1">{(error as Error).message || 'Попробуйте обновить страницу'}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 bg-background">
        <Skeleton className="h-8 w-48 bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="border bg-card/50">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-16 mb-3 bg-muted" />
                <Skeleton className="h-7 w-28 bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const analysis = data

  return (
    <div className="space-y-6 bg-background p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Дашборд</h1>
          <p className="text-muted-foreground">
            {user?.companyName || 'Ваша компания'} — {metrics.stage.replace('_', ' ')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Settings className="w-4 h-4 mr-2" />
            {isEditing ? 'Готово' : 'Изменить'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="MRR"
          value={`$${metrics.mrr.toLocaleString()}`}
          icon={DollarSign}
          field="mrr"
          editable
          metrics={metrics}
          isEditing={isEditing}
          onMetricChange={handleMetricChange}
        />
        <StatCard
          title="CAC"
          value={`$${metrics.cac.toLocaleString()}`}
          icon={Users}
          field="cac"
          editable
          metrics={metrics}
          isEditing={isEditing}
          onMetricChange={handleMetricChange}
        />
        <StatCard
          title="LTV"
          value={`$${metrics.ltv.toLocaleString()}`}
          icon={TrendingUp}
          field="ltv"
          editable
          metrics={metrics}
          isEditing={isEditing}
          onMetricChange={handleMetricChange}
        />
        <StatCard
          title="Runway"
          value={`${metrics.runwayMonths ?? metrics.runway_months ?? 18} мес.`}
          icon={Clock}
          healthy={(metrics.runwayMonths ?? metrics.runway_months ?? 18) > 12}
          field="runway_months"
          editable
          metrics={metrics}
          isEditing={isEditing}
          onMetricChange={handleMetricChange}
        />
      </div>

      {/* Дополнительные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Churn Rate"
          value={`${(metrics.churn * 100).toFixed(1)}%`}
          icon={TrendingDown}
          healthy={metrics.churn <= 0.05}
          field="churn"
          editable
          metrics={metrics}
          isEditing={isEditing}
          onMetricChange={handleMetricChange}
        />
        <StatCard
          title="ARPU"
          value={`$${metrics.arpu.toLocaleString()}`}
          icon={DollarSign}
          field="arpu"
          editable
          metrics={metrics}
          isEditing={isEditing}
          onMetricChange={handleMetricChange}
        />
        <StatCard
          title="Активные пользователи"
          value={metrics.active_users?.toString() || '0'}
          icon={Users}
          field="active_users"
          editable
          metrics={metrics}
          isEditing={isEditing}
          onMetricChange={handleMetricChange}
        />
      </div>

      {/* Анализ */}
      {analysis && (
        <Card className="border bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
               <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                 <TrendingUp className="w-4 h-4 text-primary" />
               </div>
               <h3 className="font-semibold text-foreground">Анализ метрик</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">LTV/CAC</p>
                <p className={`text-2xl font-bold ${analysis.ltv_cac_ratio >= 3 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {((analysis as any).ltvCacRatio ?? analysis.ltv_cac_ratio).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">x</span>
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Churn Rate</p>
                <p className={`text-2xl font-bold ${analysis.churn <= 0.05 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {(analysis.churn * 100).toFixed(1)}<span className="text-sm font-normal text-muted-foreground">%</span>
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Статус</p>
                <p className={`text-lg font-semibold ${analysis.healthy ? 'text-emerald-500' : 'text-destructive'}`}>
                  {analysis.healthy ? '✅ Здоровый' : '⚠️ Внимание'}
                </p>
              </div>
            </div>

            {analysis.alerts && analysis.alerts.length > 0 && (
              <div className="space-y-2">
                {analysis.alerts.map((alert: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-700">{alert}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
