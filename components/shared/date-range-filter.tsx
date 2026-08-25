"use client"

import * as React from "react"
import type { DateRange } from "react-day-picker"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDateShort, parseDate, toDateInput } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * The from/to date-window filter shared by Dashboard, Reports, Payments and
 * Enquiries — a shadcn Calendar in a Popover instead of two native date
 * inputs, so the two ends are picked as one range rather than two fiddly
 * fields.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  className,
  placeholder = "Date range",
}: {
  from?: string
  to?: string
  onChange: (range: { from?: string; to?: string }) => void
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)

  const selected: DateRange | undefined = React.useMemo(() => {
    const fromDate = parseDate(from)
    const toDate = parseDate(to)
    if (!fromDate && !toDate) return undefined
    return { from: fromDate ?? undefined, to: toDate ?? undefined }
  }, [from, to])

  const label = selected?.from
    ? selected.to && selected.to.getTime() !== selected.from.getTime()
      ? `${formatDateShort(selected.from)} – ${formatDateShort(selected.to)}`
      : formatDateShort(selected.from)
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "justify-start font-normal",
              !selected?.from && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          onSelect={(range) =>
            onChange({
              from: range?.from ? toDateInput(range.from) : undefined,
              to: range?.to ? toDateInput(range.to) : undefined,
            })
          }
        />
        {selected?.from && (
          <div className="flex justify-end border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ from: undefined, to: undefined })
                setOpen(false)
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
