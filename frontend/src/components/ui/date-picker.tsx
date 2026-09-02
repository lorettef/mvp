import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useTranslation } from 'react-i18next'
import { enUS, ru } from 'date-fns/locale'
import { format, isValid, parse } from 'date-fns'
import type { Matcher } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

const parseDateValue = (value: string): Date | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value ? parsed : undefined
}

export interface DatePickerProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly disabledDates?: Matcher | Matcher[]
  readonly className?: string
  readonly 'aria-label'?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  disabledDates,
  className,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const selectedDate = parseDateValue(value)
  const locale = i18n.language === 'en' ? enUS : ru
  const localeCode = i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString(localeCode, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null
  const emptyLabel = placeholder ?? (i18n.language === 'en' ? 'Choose a date' : 'Выберите дату')
  const clearLabel = i18n.language === 'en' ? 'Clear date' : 'Очистить дату'

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
          className="z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-md outline-none"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onChange(date ? format(date, 'yyyy-MM-dd') : '')
              setOpen(false)
            }}
            defaultMonth={selectedDate ?? new Date()}
            locale={locale}
            disabled={disabledDates}
            showOutsideDays
            labels={{
              labelNext: () => (i18n.language === 'en' ? 'Next month' : 'Следующий месяц'),
              labelPrevious: () =>
                i18n.language === 'en' ? 'Previous month' : 'Предыдущий месяц',
            }}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-3 ml-3 mr-3 w-[calc(100%-1.5rem)] justify-center text-muted-foreground"
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
