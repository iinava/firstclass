"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon } from "lucide-react"
import type { Control, FieldPath, FieldValues } from "react-hook-form"
import { Controller } from "react-hook-form"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { OptionSelect } from "@/components/shared/option-select"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useDebouncedValue } from "@/hooks/use-list-params"
import { formatPhone } from "@/lib/format"
import { qk } from "@/lib/query-keys"
import { fetchCustomers } from "@/app/admin/customers/actions"

/**
 * Search-then-select customer field.
 *
 * A plain dropdown stops working once the customer list grows past a few
 * hundred, and a full combobox is overkill inside a dialog — so this pairs a
 * debounced search box with a select of the matches, which also keeps the whole
 * thing keyboard- and mobile-friendly.
 */
export function CustomerPicker<T extends FieldValues>({
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

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rows = data?.rows ?? []
        // The selected customer may not be in the current search results —
        // keep it in the list so the select never silently loses its value.
        const hasSelected =
          !field.value || rows.some((row) => row.id === field.value)

        const options = [
          { value: "", label: isFetching ? "Searching…" : "Select a customer" },
          ...(hasSelected
            ? []
            : [{ value: field.value as string, label: "Currently selected" }]),
          ...rows.map((customer) => ({
            value: customer.id,
            label: `${customer.name} — ${formatPhone(customer.phone)}`,
          })),
        ]

        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="Search by name or phone…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search customers"
              />
              <InputGroupAddon>
                <SearchIcon className="size-4 text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>

            <OptionSelect
              id={id}
              className="w-full"
              name={field.name}
              options={options}
              value={(field.value as string) ?? ""}
              onValueChange={(value) => field.onChange(value || null)}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid}
            />

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
