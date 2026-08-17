import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { humanize } from "@/lib/format"

/**
 * Semantic colour per status, shared by every module so "confirmed" looks the
 * same on a booking as it does on an invoice.
 *
 * Colours are written as translucent fills so they read correctly in both
 * themes without a separate dark-mode palette.
 */
const TONE = {
  neutral: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  progress:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  success:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  accent:
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
} as const

export type StatusTone = keyof typeof TONE

const STATUS_TONES: Record<string, StatusTone> = {
  // leads
  new: "info",
  contacted: "info",
  quoted: "accent",
  negotiating: "progress",
  won: "success",
  lost: "danger",
  // follow-ups
  pending: "progress",
  done: "success",
  missed: "danger",
  cancelled: "neutral",
  // bookings
  confirmed: "info",
  in_progress: "progress",
  completed: "success",
  // invoices / payables
  draft: "neutral",
  sent: "info",
  partially_paid: "progress",
  paid: "success",
  unpaid: "danger",
  partial: "progress",
  // itineraries
  published: "success",
  accepted: "success",
  rejected: "danger",
  archived: "neutral",
  // procurement
  planned: "neutral",
  booked: "info",
  // hrms
  present: "success",
  absent: "danger",
  half_day: "progress",
  leave: "info",
  approved: "success",
  active: "success",
  // priority
  low: "neutral",
  medium: "info",
  high: "danger",
}

interface StatusBadgeProps {
  status: string | null | undefined
  label?: string
  tone?: StatusTone
  className?: string
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const resolved = tone ?? STATUS_TONES[status] ?? "neutral"

  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", TONE[resolved], className)}
    >
      {label ?? humanize(status)}
    </Badge>
  )
}
