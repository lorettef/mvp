import { type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  healthy?: boolean
  field?: string
  editable?: boolean
  gradient?: string
  metrics: Record<string, number>
  isEditing: boolean
  onMetricChange: (field: string, value: number) => void
}

export function StatCard({
  title, value, icon: Icon, healthy = true, field, editable = false, gradient = '',
  metrics, isEditing, onMetricChange,
}: StatCardProps) {
  return (
    <Card className="border-border bg-card/50 hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            {editable && isEditing && field ? (
              <Input
                type="number"
                className="w-28 mt-1 text-lg font-bold"
                value={metrics[field]}
                onChange={(e) => onMetricChange(field, Number(e.target.value))}
              />
            ) : (
              <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${healthy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'} group-hover:scale-110 transition-transform duration-200`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {editable && !isEditing && field && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: '30%' }} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
