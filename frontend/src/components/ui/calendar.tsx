import { DayPicker, type DayPickerProps } from 'react-day-picker'
import 'react-day-picker/style.css'

const calendarClassNames = {
  root: 'p-3 text-foreground',
  months: 'flex flex-col gap-4',
  month: 'space-y-4',
  month_caption: 'relative flex h-8 items-center justify-center',
  caption_label: 'text-sm font-medium',
  nav: 'absolute inset-x-0 flex items-center justify-between',
  button_previous:
    'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  button_next:
    'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'w-8 rounded-md text-center text-xs font-normal text-muted-foreground',
  week: 'mt-2 flex w-full',
  day: 'h-8 w-8 p-0 text-center text-sm',
  day_button:
    'inline-flex h-8 w-8 items-center justify-center rounded-md p-0 font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90',
  today: '[&>button]:font-semibold [&>button]:text-primary',
  outside: 'text-muted-foreground/50',
  disabled: 'text-muted-foreground/30',
  hidden: 'invisible',
} satisfies NonNullable<DayPickerProps['classNames']>

export function Calendar({ classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      {...props}
      classNames={{ ...calendarClassNames, ...classNames }}
    />
  )
}
