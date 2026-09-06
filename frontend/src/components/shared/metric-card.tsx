import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export type TrendDirection = "up" | "down" | "flat"

export interface MetricCardProps {
  label: string
  value: ReactNode
  /** Signed delta, e.g. 18.4 for +18.4%, -3.2 for -3.2%. */
  delta?: number | null
  /** e.g. "%" (default) or a currency symbol. */
  deltaSuffix?: string
  /** Context line, e.g. "vs last month". */
  context?: string
  /** Inverts the good/bad color semantics (e.g. churn where down is good). */
  invert?: boolean
  icon?: ReactNode
  className?: string
}

export function MetricCard({
  label,
  value,
  delta,
  deltaSuffix = "%",
  context,
  invert = false,
  icon,
  className,
}: MetricCardProps) {
  const hasDelta = delta !== null && delta !== undefined
  const rawPositive = hasDelta && (delta as number) >= 0
  const good = invert ? !rawPositive : rawPositive
  const direction: TrendDirection = !hasDelta
    ? "flat"
    : (delta as number) > 0
      ? "up"
      : (delta as number) < 0
        ? "down"
        : "flat"

  return (
    <Card className={cn("border bg-card", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {icon ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              {icon}
            </span>
          ) : null}
        </div>
        <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-sm">
          {hasDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                good ? "text-success" : "text-destructive"
              )}
            >
              {direction === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
              {direction === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
              {direction === "flat" && <Minus className="h-3.5 w-3.5" />}
              {direction === "up" ? "+" : ""}
              {delta}
              {deltaSuffix}
            </span>
          )}
          {context ? (
            <span className="text-muted-foreground">{context}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
