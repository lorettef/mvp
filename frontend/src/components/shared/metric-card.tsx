import { Fragment, type ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { MetricHelp } from "@/components/shared/metric-help"

export type TrendDirection = "up" | "down" | "flat"

export interface MetricCardProps {
  label: string
  description?: string
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
  /** Mini trend line; rendered only when >= 3 numeric points are provided. */
  sparkline?: (number | null | undefined)[]
  /** Optional plan/fact breakdown line, e.g. { plan: "1.1M ₽", fact: "1.2M ₽" }. */
  planFact?: { plan: ReactNode; fact: ReactNode } | null
  /** Period label shown under the value, e.g. "Май 2026". */
  period?: string
  className?: string
  compact?: boolean
}

function Sparkline({ points }: { points: number[] }) {
  const width = 96
  const height = 32
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = width / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = i * step
    const y = height - 3 - ((v - min) / range) * (height - 6)
    return [x, y] as const
  })
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-full overflow-visible"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MetricCard({
  label,
  description,
  value,
  delta,
  deltaSuffix = "%",
  context,
  invert = false,
  icon,
  sparkline,
  planFact,
  period,
  className,
  compact = false,
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

  const sparkPoints = (sparkline ?? []).filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  // Currency formatters use non-breaking group separators. Allow a narrow
  // card to wrap between groups while preserving the complete value text.
  const valueText = typeof value === "string" && value.includes("\u00a0")
    ? value.split("\u00a0").map((group, index) => (
      <Fragment key={index}>{index > 0 && <>{"\u00a0"}<wbr /></>}{group}</Fragment>
    ))
    : value

  return (
    <Card className={cn("min-w-0 border bg-card [container-type:inline-size]", className)}>
      <CardContent className={compact ? "min-w-0 px-3 py-4" : "min-w-0 p-5"}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {description ? (
            <MetricHelp label={label} description={description} className={cn("min-w-0 flex-1 font-medium uppercase text-muted-foreground [overflow-wrap:anywhere]", compact ? "text-[11px] leading-tight tracking-wide" : "text-xs tracking-wider")} />
          ) : (
            <span className={cn("min-w-0 flex-1 font-medium uppercase text-muted-foreground [overflow-wrap:anywhere]", compact ? "text-[11px] leading-tight tracking-wide" : "text-xs tracking-wider")}>{label}</span>
          )}
          {icon ? (
            <span className={cn("flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", compact ? "h-7 w-7" : "h-8 w-8")}>
              {icon}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex min-w-0 flex-wrap items-end justify-between gap-2">
          <div className="min-w-0 basis-24 flex-1">
            <div className={cn("font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere]", compact ? "text-[clamp(1.125rem,10cqi,1.5rem)]" : "text-2xl")}>
              {valueText}
            </div>
            {period ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{period}</div>
            ) : null}
          </div>
          {sparkPoints.length >= 3 ? (
            <span className={cn("min-w-0 w-24 max-w-full text-primary", good ? "text-success" : "text-muted-foreground")}>
              <Sparkline points={sparkPoints} />
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-sm [overflow-wrap:anywhere]">
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
        {planFact ? (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground tabular-nums [overflow-wrap:anywhere]">
            <span className="min-w-0">
              <span className="font-medium text-foreground">{planFact.plan}</span> план
            </span>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{planFact.fact}</span> факт
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
