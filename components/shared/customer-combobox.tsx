"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import type { Control, FieldPath, FieldValues } from "react-hook-form"
import { Controller } from "react-hook-form"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useDebouncedValue } from "@/hooks/use-list-params"
import { formatPhone } from "@/lib/format"
import { qk } from "@/lib/query-keys"
import { fetchCustomers } from "@/app/admin/customers/actions"

interface CustomerOption {
  value: string
  label: string
}

/**
 * Search-then-select customer field, backed by the shadcn/Base UI combobox.
 *
 * The search box and the result list are one widget instead of a separate
 * search input plus a plain select. Filtering happens server-side (the same
 * `fetchCustomers` action the customer list page uses) since the customer
 * table can grow well past what a client-side filter should scan.
 */
export function CustomerCombobox<T extends FieldValues>({
  control,
  name,
  label = "Customer",
  description,
}: {
  control: Control<T>
  name: FieldPath<T>
  label?: string
  description?: string
}) {
  const [search, setSearch] = React.useState("")
  const debounced = useDebouncedValue(search, 300)

  const { data, isFetching } = useQuery({
    queryKey: qk.customers.list({ search: debounced || undefined, picker: true }),
    queryFn: async () =>
      unwrapAction(
        await fetchCustomers({
          page: 1,
          pageSize: 50,
          search: debounced || undefined,
          sortBy: "name",
          sortDir: "asc",
        } as never)
      ),
    placeholderData: (previous) => previous,
  })

  const id = `field-${name}`
  // Caches the last label we actually resolved for the selected id, so a
  // later search that no longer includes it still shows a real name instead
  // of a generic placeholder overwriting what's on screen.
  const lastKnownLabel = React.useRef<{ value: string; label: string } | null>(null)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const items: CustomerOption[] = (data?.rows ?? []).map((customer) => ({
          value: customer.id,
          label: `${customer.name} — ${formatPhone(customer.phone)}`,
        }))

        const found = items.find((item) => item.value === field.value)
        if (found) lastKnownLabel.current = found

        // The selected customer may not be in the current search results —
        // keep it selectable so the combobox never silently loses its value.
        const selected =
          found ??
          (field.value
            ? (lastKnownLabel.current?.value === field.value
                ? lastKnownLabel.current
                : { value: field.value as string, label: "Currently selected" })
            : null)

        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Combobox<CustomerOption>
              items={items}
              value={selected}
              onValueChange={(item) => field.onChange(item ? item.value : null)}
              onInputValueChange={(value, eventDetails) => {
                // Selecting an item (or the list re-syncing the input to its
                // label) also fires this — only real typing should drive a
                // new server search, otherwise the selected item's own label
                // gets searched for, finds nothing, and knocks it out of
                // `items` right after it was picked.
                if (eventDetails.reason === "input-change" || eventDetails.reason === "input-clear") {
                  setSearch(value)
                }
              }}
              isItemEqualToValue={(a, b) => a?.value === b?.value}
              filter={null}
            >
              <ComboboxInput
                id={id}
                placeholder="Search by name or phone…"
                showClear
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  {isFetching ? "Searching…" : "No customers found"}
                </ComboboxEmpty>
                <ComboboxList>
                  {(item: CustomerOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>

            {description && !fieldState.error && (
              <FieldDescription>{description}</FieldDescription>
            )}
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
