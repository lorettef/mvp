import { cn } from "@/lib/utils"

/** Gradient brand tile + shield glyph. Single source of truth for the logo mark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-primary-foreground shadow-sm",
        className
      )}
    >
      <svg className="h-[55%] w-[55%]" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M24 4L6 14v12c0 11.05 7.68 21.37 18 24 10.32-2.63 18-12.95 18-24V14L24 4z"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M18 22l4 4 8-8"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function Logo({
  className,
  markClassName,
  subtitle,
}: {
  className?: string
  markClassName?: string
  subtitle?: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={markClassName} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold leading-none">Startup Investment Bridge</span>
        {subtitle ? (
          <span className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
    </div>
  )
}
