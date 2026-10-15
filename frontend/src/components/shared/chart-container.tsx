import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type ChartContainerProps = ComponentPropsWithoutRef<'div'> & (
  | { height: number; aspectRatio?: never }
  | { aspectRatio: number; height?: never }
)

/** A measurable box only; Recharts owns observation and chart rendering. */
export function ChartContainer({ height, aspectRatio, className, style, ...props }: ChartContainerProps) {
  return <div {...props} className={cn('min-w-0 w-full', className)} style={{ ...style, height, aspectRatio }} />
}
