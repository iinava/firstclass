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
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      {/* Sentence case, not uppercase tracking — this is a sentence about the
          business, not a column heading in a report. */}
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate text-sm text-muted-foreground">{label}</span>
      </div>

      <p
        className={cn(
          "mt-2.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums",
          TONE_CLASS[tone]
        )}
      >
        {value}
      </p>

      {sub && (
        <p className="mt-2 truncate text-[13px] text-muted-foreground">{sub}</p>
      )}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2.5 h-7 w-28" />
      <Skeleton className="mt-2 h-3.5 w-20" />
    </div>
  )
}
