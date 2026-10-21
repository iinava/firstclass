"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { useDebouncedValue } from "@/hooks/use-list-params"
import type { PickerOption, PickerQuery } from "@/validations/common.validation"

/**
 * Server-searched select for any table that can outgrow a plain dropdown —
 * suppliers, customers, trips, packages, employees.
 *
 * Opening it shows the first page of results; typing searches the whole table
 * on the server, so nothing past the first page is ever unreachable. The
 * saved value's label is fetched by id when it isn't in the current page, so
 * an edit form never opens on a blank or "unknown" selection.
 *
 * `fetchOptions` is a picker action (`PickerQuerySchema` in, `PickerOption[]`
 * out) — see `components/shared/pickers.tsx` for the ready-made ones.
 */

export type FetchPickerOptions = (query: PickerQuery) => Promise<PickerOption[]>

export interface SearchableSelectProps {
  value: string | null
  onValueChange: (value: string | null, option: PickerOption | null) => void
  /** Cache key prefix — should sit under the entity's `qk.*.all` so mutations refresh it. */
  queryKey: readonly unknown[]
  fetchOptions: FetchPickerOptions
  placeholder?: string
  emptyText?: string
  /** Shows the × button. Off for required fields, where clearing only produces an error. */
  clearable?: boolean
  disabled?: boolean
  id?: string
  className?: string
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  "aria-invalid"?: boolean
}

export function SearchableSelect({
  value,
  onValueChange,
  queryKey,
  fetchOptions,
  placeholder = "Search…",
  emptyText = "No matches",
  clearable = true,
  disabled,
  id,
  className,
  onBlur,
  "aria-invalid": ariaInvalid,
}: SearchableSelectProps) {
  const [search, setSearch] = React.useState("")
  const debounced = useDebouncedValue(search.trim(), 300)

  // The option the user last picked — keeps its label on screen when a later
  // search no longer includes it, without a round trip.
  const [picked, setPicked] = React.useState<PickerOption | null>(null)

  const { data: items = [], isFetching } = useQuery({
    queryKey: [...queryKey, "picker", debounced],
    queryFn: () => fetchOptions({ search: debounced || undefined }),
    placeholderData: (previous) => previous,
    staleTime: 30 * 1000,
  })

  const fromList = value ? items.find((item) => item.value === value) : undefined
  const fromPick = value && picked?.value === value ? picked : undefined
  const { data: lookedUp } = useQuery({
    queryKey: [...queryKey, "picker-ids", value],
    queryFn: () => fetchOptions({ ids: [value!] }),
    enabled: Boolean(value) && !fromList && !fromPick,
    staleTime: 5 * 60 * 1000,
  })

  const selected = value
    ? (fromList ??
      fromPick ??
      lookedUp?.find((item) => item.value === value) ?? { value, label: "Loading…" })
    : null

  return (
    <Combobox<PickerOption>
      items={items}
      value={selected}
      onValueChange={(item) => {
        setPicked(item ?? null)
        onValueChange(item?.value ?? null, item ?? null)
      }}
      onInputValueChange={(next, details) => {
        // Picking an item also re-syncs the input to its label — only real
        // typing should start a new search, or the picked label gets searched
        // for and the list collapses to that one row.
        if (details.reason === "input-change" || details.reason === "input-clear") {
          setSearch(next)
        }
      }}
      onOpenChange={(open) => {
        // Reopening starts from the full first page, not the last search.
        if (!open) setSearch("")
      }}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a?.value === b?.value}
      filter={null}
      autoHighlight
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        className={className}
        placeholder={placeholder}
        showClear={clearable && Boolean(value)}
        disabled={disabled}
        onBlur={onBlur}
        aria-invalid={ariaInvalid}
      />
      <ComboboxContent>
        <ComboboxEmpty>{isFetching ? "Searching…" : emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: PickerOption) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{item.label}</span>
                {item.hint && (
                  <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export interface SearchableSelectFieldProps<T extends FieldValues>
  extends Pick<
    SearchableSelectProps,
    "queryKey" | "fetchOptions" | "placeholder" | "emptyText" | "disabled"
  > {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  className?: string
  /** Emits null when cleared so optional FKs store NULL; otherwise "" (fails `required`). */
  nullable?: boolean
  /** Fires with the full option when the user picks or clears — for dependent fields. */
  onOptionChange?: (option: PickerOption | null) => void
}

/** `SearchableSelect` wired into react-hook-form, mirroring `SelectField`. */
export function SearchableSelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  nullable = false,
  onOptionChange,
  ...selectProps
}: SearchableSelectFieldProps<T>) {
  const id = `field-${name}`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <SearchableSelect
            {...selectProps}
            id={id}
            className="w-full"
            value={field.value ? String(field.value) : null}
            onValueChange={(value, option) => {
              field.onChange(value ?? (nullable ? null : ""))
              onOptionChange?.(option)
            }}
            clearable={nullable}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
          />
          {description && !fieldState.error && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
