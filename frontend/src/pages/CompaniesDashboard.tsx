import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi, companiesApi } from '../api/companies'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, TrendingUp, CircleCheck, AlertTriangle, Plus, AlertCircle } from 'lucide-react'

const statusMap: Record<string, { label: string; className: string }> = {
  on_track: { label: 'Выполняет план', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  behind: { label: 'Отстаёт', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  no_plan: { label: 'Без плана', className: 'bg-muted text-muted-foreground border-border' },
  no_data: { label: 'Нет данных', className: 'bg-muted text-muted-foreground border-border' },
}

const fmtRub = (v: number | null) => (v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`)

export const CompaniesDashboard = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [geography, setGeography] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
  })

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; industry?: string; geography?: string }) =>
      companiesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setShowForm(false)
      setName('')
      setIndustry('')
      setGeography('')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border bg-card/50">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-16 mb-3" />
                <Skeleton className="h-7 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">Ошибка загрузки портфеля</p>
          <p className="text-muted-foreground text-sm mt-1">{(error as Error).message || 'Попробуйте обновить страницу'}</p>
        </div>
      </div>
    )
  }

  const total = data?.totalCompanies ?? 0
  const onTrack = data?.onTrack ?? 0
  const behind = data?.behind ?? 0
  const onTrackPct = total > 0 ? Math.round((onTrack / total) * 100) : 0

  const cards = [
    { title: 'Компании в портфеле', value: String(total), icon: Building2 },
    { title: 'Средний MRR', value: fmtRub(data?.avgMrr ?? null), icon: TrendingUp },
    { title: 'Выполняют план', value: `${onTrackPct}%`, icon: CircleCheck },
    { title: 'Отстают', value: String(behind), icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Портфель компаний</h1>
          <p className="text-muted-foreground">Обзор всех стартапов акселератора</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить компанию
        </Button>
      </div>

      {showForm && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Название компании"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Сфера деятельности"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
              <Input
                placeholder="География"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                disabled={!name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name, industry, geography })}
              >
                {createMutation.isPending ? 'Создание...' : 'Создать'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="border bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <c.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border bg-card/50">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left font-medium px-5 py-3">Компания</th>
                <th className="text-left font-medium px-5 py-3 hidden sm:table-cell">Сфера</th>
                <th className="text-left font-medium px-5 py-3">MRR (факт)</th>
                <th className="text-left font-medium px-5 py-3 hidden md:table-cell">MRR (план)</th>
                <th className="text-left font-medium px-5 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {(data?.companies ?? []).map((c) => {
                const s = statusMap[c.status] ?? statusMap.no_data
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/companies/${c.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{c.industry || '—'}</td>
                    <td className="px-5 py-3 text-foreground">{fmtRub(c.latestMrr)}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{fmtRub(c.latestPlanMrr)}</td>
                    <td className="px-5 py-3">
                      <Badge className={s.className}>{s.label}</Badge>
                    </td>
                  </tr>
                )
              })}
              {(data?.companies ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    Пока нет компаний. Добавьте первую компанию.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
