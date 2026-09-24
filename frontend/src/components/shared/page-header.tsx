import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
  alignTitleWithActions = false,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  alignTitleWithActions?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        alignTitleWithActions
          ? "md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-4 md:gap-y-0"
          : "sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className={cn("min-w-0", alignTitleWithActions && "md:contents")}>
        <h1
          className={cn(
            "text-2xl font-bold tracking-tight",
            alignTitleWithActions && "break-words md:col-start-1 md:row-start-1"
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-1 text-sm text-muted-foreground",
              alignTitleWithActions && "md:col-start-1 md:row-start-2"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            alignTitleWithActions && "md:col-start-2 md:row-start-1"
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
}
