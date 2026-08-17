import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  /** Tints the value — use sparingly, for money and alert counts. */
  tone?: "default" | "positive" | "negative" | "warning"
  className?: string
}

const TONE_CLASS = {
  default: "",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
} as const

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div>
        <p
          className={cn(
            "text-2xl font-bold tracking-tight tabular-nums",
            TONE_CLASS[tone]
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-20" />
    </div>
  )
}
