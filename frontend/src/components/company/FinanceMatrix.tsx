import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatMonthLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

type Scenario = 'plan' | 'fact'
interface MatrixRow { key: string; label: ReactNode; bold?: boolean }
interface Props<Row extends MatrixRow> {
  periods: string[]
  rows: Row[]
  mobile: boolean
  columnLabel: string
  tableLabel: string
  renderCell: (row: Row, period: string, type: Scenario, mobile: boolean) => ReactNode
}

/** Presentation only: callers select periods, sources and financial values. */
export function FinanceMatrix<Row extends MatrixRow>({ periods, rows, mobile, columnLabel, tableLabel, renderCell }: Props<Row>) {
  const { t, i18n } = useTranslation()
  const types: Scenario[] = ['plan', 'fact']
  return <table className={cn('w-full border-separate border-spacing-0 text-xs sm:text-sm', mobile && 'table-fixed')} aria-label={tableLabel}>
    <thead>
      <tr>
        <th scope="col" rowSpan={mobile ? 1 : 2} className={cn('sticky left-0 z-20 border-b border-r border-border bg-card px-3 py-2 text-left font-medium', mobile ? 'w-[40%]' : 'min-w-[10rem]')}>{columnLabel}</th>
        {mobile
          ? types.map((type) => <th key={type} scope="col" className="border-b px-2 py-2 text-right">{t(`common.${type}`)}</th>)
          : periods.map((period) => <th key={period} scope="colgroup" colSpan={2} className="border-b border-r border-border bg-muted/30 px-3 py-2 text-center font-medium whitespace-nowrap">{formatMonthLabel(period.slice(0, 7), i18n.language)}</th>)}
      </tr>
      {!mobile && <tr>{periods.flatMap((period) => types.map((type) => <th key={`${period}-${type}`} scope="col" className={cn('min-w-[8rem] border-b border-border px-3 py-2 text-right font-normal', type === 'fact' && 'border-r')}>{t(`common.${type}`)}</th>))}</tr>}
    </thead>
    <tbody>{rows.map((row) => <tr key={row.key}>
      <th scope="row" className={cn('sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 text-left', row.bold ? 'font-semibold' : 'font-normal')}>{row.label}</th>
      {periods.flatMap((period) => types.map((type) => <td key={`${period}-${type}`} className={cn('border-b border-border px-2 py-2 text-right tabular-nums whitespace-nowrap', row.bold && 'font-semibold', type === 'fact' && 'border-r')}>
        {renderCell(row, period, type, mobile)}
      </td>))}
    </tr>)}</tbody>
  </table>
}

export function FinanceSourceValue({ children, mobile, missing, label, actionLabel, onOpen }: {
  children: ReactNode
  mobile: boolean
  missing: boolean
  label: string
  actionLabel: string
  onOpen?: () => void
}) {
  const active = Boolean(onOpen)
  return <>
    <span role={active && !mobile ? 'button' : undefined} tabIndex={active && !mobile ? 0 : undefined} aria-label={active && !mobile ? label : undefined}
      className={cn('inline-block rounded px-1 py-0.5', active && 'cursor-pointer hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', missing && 'text-muted-foreground')}
      onDoubleClick={onOpen}
      onKeyDown={active ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen?.() } } : undefined}>
      {children}
    </span>
    {mobile && active && <Button type="button" variant="ghost" size="sm" className="block ml-auto h-7 max-w-full px-0 text-[11px]" aria-label={label} onClick={onOpen}>{actionLabel}</Button>}
  </>
}
