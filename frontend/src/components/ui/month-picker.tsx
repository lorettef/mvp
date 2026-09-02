import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMonthLabel } from '@/lib/format'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

const parseMonthValue = (value: string): Date | undefined => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return undefined
  const [yearText, monthText] = value.split('-')
  return new Date(Number(yearText), Number(monthText) - 1, 1)
}

const currentYear = () => new Date().getFullYear()

export interface MonthPickerProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly className?: string
  readonly 'aria-label'?: string
}

export function MonthPicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: MonthPickerProps) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => parseMonthValue(value)?.getFullYear() ?? currentYear())
  const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const selectedMonth = parseMonthValue(value)
  const selectedLabel = selectedMonth ? formatMonthLabel(value, locale) : null
  const emptyLabel = placeholder ?? (i18n.language === 'en' ? 'Choose a month' : 'Выберите месяц')
  const clearLabel = i18n.language === 'en' ? 'Clear month' : 'Очистить месяц'

  useEffect(() => {
    const nextYear = parseMonthValue(value)?.getFullYear()
    if (nextYear !== undefined) setYear(nextYear)
  }, [value])

  const selectMonth = (month: number) => {
    const nextValue = `${year}-${String(month).padStart(2, '0')}`
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn(!selectedLabel && 'text-muted-foreground')}>
            {selectedLabel ?? emptyLabel}
          </span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={i18n.language === 'en' ? 'Previous year' : 'Предыдущий год'}
              onClick={() => setYear((current) => current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="text-sm font-semibold">{year}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={i18n.language === 'en' ? 'Next year' : 'Следующий год'}
              onClick={() => setYear((current) => current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3" role="group" aria-label={String(year)}>
            {MONTHS.map((month) => {
              const monthValue = `${year}-${String(month).padStart(2, '0')}`
              const isSelected = monthValue === value
              return (
                <button
                  key={monthValue}
                  type="button"
                  aria-label={formatMonthLabel(monthValue, locale)}
                  aria-pressed={isSelected}
                  className={cn(
                    'rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                  onClick={() => selectMonth(month)}
                >
                  {formatMonthLabel(monthValue, locale).split(' ')[0]}
                </button>
              )
            })}
          </div>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-center text-muted-foreground"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              <X className="h-4 w-4" />
              {clearLabel}
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
