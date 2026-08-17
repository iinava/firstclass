"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Options-array shorthand over the shadcn Select.
 *
 * The native `<select>` this replaces rendered its popup through the OS, which
 * ignores the app theme — options came out dark-on-white in dark mode. Every
 * dropdown in the admin goes through here so the list is themed markup.
 *
 * Values are plain strings; `""` is a real selectable option (the "All" rows in
 * list filters), so the placeholder only shows when the value is null.
 */

export interface SelectOption {
  value: string
  label: string
}

interface OptionSelectProps {
  options: SelectOption[]
  value: string
  onValueChange: (value: string) => void
  /** Shown when no option matches — list filters instead pass an `""` option. */
  placeholder?: string
  className?: string
  size?: "sm" | "default"
  disabled?: boolean
  id?: string
  name?: string
  onBlur?: React.FocusEventHandler<HTMLElement>
  "aria-label"?: string
  "aria-invalid"?: boolean
}

export function OptionSelect({
  options,
  value,
  onValueChange,
  placeholder,
  className,
  size = "default",
  disabled,
  id,
  name,
  onBlur,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: OptionSelectProps) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => onValueChange(next ?? "")}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Turns a labels record into the option list the selects expect. */
export function optionsFrom<K extends string>(
  values: readonly K[],
  labels: Record<K, string>
): SelectOption[] {
  return values.map((value) => ({ value, label: labels[value] }))
}
