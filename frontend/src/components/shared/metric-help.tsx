import { useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export function MetricHelp({ label, description, className, side = 'top' }: {
  label: string
  description: string
  className?: string
  side?: 'top' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const hoveredByMouse = useRef(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn('cursor-help text-left underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') {
              hoveredByMouse.current = true
              setOpen(true)
            }
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') {
              hoveredByMouse.current = false
              setOpen(false)
            }
          }}
          onClick={(event) => {
            if (hoveredByMouse.current && event.detail > 0) event.preventDefault()
          }}
        >
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={side === 'right' ? 40 : 2}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn('z-50 rounded-md border border-border bg-popover p-3 text-sm font-normal normal-case tracking-normal text-popover-foreground shadow-md outline-none', side === 'right' ? 'w-[min(11rem,calc(100vw-2rem))]' : 'w-[min(18rem,calc(100vw-2rem))]')}
        >
          {description}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
