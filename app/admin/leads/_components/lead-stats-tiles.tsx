"use client"

import { CheckCircle2Icon, InboxIcon, TrendingUpIcon, XCircleIcon } from "lucide-react"
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card"
import { formatNumber } from "@/lib/format"

interface LeadStats {
  total: number
  open: number
  won: number
  lost: number
  conversionRate: number
}

export function LeadStatsTiles({ stats }: { stats?: LeadStats }) {
  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Open enquiries"
        value={formatNumber(stats.open)}
        sub="Still in the pipeline"
        icon={InboxIcon}
      />
      <StatCard
        label="Won"
        value={formatNumber(stats.won)}
        sub="Converted to bookings"
        icon={CheckCircle2Icon}
        tone="positive"
      />
      <StatCard
        label="Lost"
        value={formatNumber(stats.lost)}
        sub="Closed without booking"
        icon={XCircleIcon}
        tone={stats.lost > stats.won ? "negative" : "default"}
      />
      <StatCard
        label="Conversion"
        value={`${stats.conversionRate}%`}
        sub="Of closed enquiries"
        icon={TrendingUpIcon}
        tone={stats.conversionRate >= 40 ? "positive" : "warning"}
      />
    </div>
  )
}
