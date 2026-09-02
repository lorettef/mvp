import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HiringPlanResponse, HiringSettingsUpsert } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw } from 'lucide-react'
import { fmtPct, fmtPeriod, fmtRub } from '@/lib/format'

interface HiringTabProps {
  data?: HiringPlanResponse
  isLoading?: boolean
  isRefetching?: boolean
  isSaving?: boolean
  canEdit?: boolean
  onGenerate?: () => void
  onSaveSettings?: (d: HiringSettingsUpsert) => void
}

export function HiringTab({
  data,
  isLoading,
  isRefetching,
  isSaving,
  canEdit,
  onGenerate,
  onSaveSettings,
}: HiringTabProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    ndfl: '13',
    insurance: '30',
    injury: '0.2',
  })

  useEffect(() => {
    if (data?.settings) {
      setForm({
        ndfl: (data.settings.ndflRate * 100).toFixed(1),
        insurance: (data.settings.insuranceRate * 100).toFixed(1),
        injury: (data.settings.injuryRate * 100).toFixed(1),
      })
    } else {
      setForm({ ndfl: '13', insurance: '30', injury: '0.2' })
    }
  }, [data?.settings, data?.companyId])

  if (isLoading) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">
            {t('company.hiring.empty')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalRate =
    (Number(form.ndfl) + Number(form.insurance) + Number(form.injury)) / 100

  const handleSave = () => {
    onSaveSettings?.({
      ndfl_rate: Number(form.ndfl) / 100,
      insurance_rate: Number(form.insurance) / 100,
      injury_rate: Number(form.injury) / 100,
    })
  }

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">{t('company.hiring.title')}</h3>
            <Button
              size="sm"
              variant="outline"
              disabled={isRefetching}
              onClick={onGenerate}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {isRefetching ? t('common.recalculating') : t('common.recalc')}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">{data.summary}</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('company.hiring.baseRevenue')}
              </p>
              <p className="text-xl font-bold mt-1">{fmtRub(data.baseRevenue)}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('company.hiring.industry')}
              </p>
              <p className="text-xl font-bold mt-1">{data.industryLabel}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('company.hiring.headcount')}
              </p>
              <p className="text-xl font-bold mt-1">{t('common.people', { count: data.finalHeadcount })}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('company.hiring.socialPayments')}
              </p>
              <p className="text-xl font-bold mt-1">
                {fmtPct(data.settings?.totalRate)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">
              {t('company.hiring.settingsTitle')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label
                  htmlFor="ndfl"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  {t('company.hiring.ndfl')}
                </label>
                <Input
                  id="ndfl"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.ndfl}
                  onChange={(e) => setForm({ ...form, ndfl: e.target.value })}
                />
              </div>
              <div>
                <label
                  htmlFor="insurance"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  {t('company.hiring.insurance')}
                </label>
                <Input
                  id="insurance"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.insurance}
                  onChange={(e) =>
                    setForm({ ...form, insurance: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="injury"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  {t('company.hiring.injury')}
                </label>
                <Input
                  id="injury"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.injury}
                  onChange={(e) => setForm({ ...form, injury: e.target.value })}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground mb-1">
                  {t('company.hiring.total')}
                </span>
                <div className="flex items-center rounded-lg border border-border px-3 py-2 text-sm flex-1">
                  <span className="font-semibold">{totalRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={isSaving} onClick={handleSave}>
                {isSaving ? t('common.saving') : t('company.hiring.saveSettings')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">{t('company.hiring.monthlyPlan')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium px-4 py-3">{t('common.month')}</th>
                  <th className="text-left font-medium px-4 py-3">{t('common.period')}</th>
                  <th className="text-left font-medium px-4 py-3">{t('company.hiring.revenue')}</th>
                  <th className="text-left font-medium px-4 py-3">{t('company.hiring.fot')}</th>
                  <th className="text-left font-medium px-4 py-3">{t('company.hiring.socialPayments')}</th>
                  <th className="text-left font-medium px-4 py-3">{t('company.hiring.totalCost')}</th>
                  <th className="text-left font-medium px-4 py-3">
                    {t('company.hiring.headcountCol')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr
                    key={m.month}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{m.month}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {fmtPeriod(m.period)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtRub(m.revenue)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtRub(m.fot)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtRub(m.socialPayments)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {fmtRub(m.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {m.headcount} ({m.devCount}/{m.salesCount}/{m.marketingCount})
                    </td>
                  </tr>
                ))}
                {data.months.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {data.baseRevenue == null
                        ? t('company.hiring.emptyAddRevenue')
                        : t('company.hiring.emptyNotCalculated')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
