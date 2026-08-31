"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate, parseDate, toDateInput } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Single-date picker: a shadcn Calendar in a Popover behind a button trigger,
 * instead of the browser's native `<input type="date">`. Value in/out is the
 * "YYYY-MM-DD" string every date column and schema in this app already uses
 * (see `dateStringSchema`), so it drops in wherever that native input did.
 */
export function DatePicker({
  value,
  onChange,
  onBlur,
  placeholder = "Pick a date",
  disabled,
  id,
  className,
  "aria-invalid": ariaInvalid,
}: {
  value?: string | null
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  "aria-invalid"?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDate(value) ?? undefined

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onBlur?.()
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            className={cn(
              "w-full justify-start font-normal",
              !selected && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {selected ? formatDate(selected) : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? toDateInput(date) : "")
            setOpen(false)
          }}
        />
        {selected && (
          <div className="flex justify-end border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("")
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
