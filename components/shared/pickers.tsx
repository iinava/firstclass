"use client"

import type { FieldValues } from "react-hook-form"
import {
  SearchableSelectField,
  type SearchableSelectFieldProps,
} from "@/components/shared/searchable-select"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { qk } from "@/lib/query-keys"
import type { PickerQuery } from "@/validations/common.validation"
import type { SUPPLIER_TYPES } from "@/validations/supplier.validation"
import { fetchCustomerOptions } from "@/app/admin/customers/actions"
import { fetchEmployeeOptions } from "@/app/admin/employees/actions"
import { fetchPackageOptions } from "@/app/admin/packages/actions"
import { fetchSupplierOptions } from "@/app/admin/suppliers/actions"
import { fetchBookingOptions } from "@/app/admin/trips/actions"

/**
 * Ready-made searchable pickers, one per master table. Forms pass the usual
 * control/name/label (plus placeholder, nullable, description); the data
 * source, cache key and empty text are fixed here so every screen that picks
 * a supplier behaves the same way.
 */

type PickerFieldProps<T extends FieldValues> = Omit<
  SearchableSelectFieldProps<T>,
  "queryKey" | "fetchOptions" | "label"
> & { label?: string }

type SupplierType = (typeof SUPPLIER_TYPES)[number]

export function SupplierSelectField<T extends FieldValues>({
  type,
  label = "Supplier",
  ...props
}: PickerFieldProps<T> & {
  /** Narrows the list (e.g. hotels only). Saved values outside it still resolve. */
  type?: SupplierType | readonly SupplierType[]
}) {
  const typeArg = Array.isArray(type) ? [...type] : (type as SupplierType | undefined)
  return (
    <SearchableSelectField
      label={label}
      placeholder="Search suppliers…"
      emptyText="No suppliers found"
      {...props}
      queryKey={qk.suppliers.options(typeArg)}
      fetchOptions={async (query: PickerQuery) =>
        unwrapAction(await fetchSupplierOptions({ ...query, type: typeArg }))
      }
    />
  )
}

export function CustomerSelectField<T extends FieldValues>({
  label = "Customer",
  ...props
}: PickerFieldProps<T>) {
  return (
    <SearchableSelectField
      label={label}
      placeholder="Search by name or phone…"
      emptyText="No customers found"
      {...props}
      queryKey={qk.customers.options()}
      fetchOptions={async (query) => unwrapAction(await fetchCustomerOptions(query))}
    />
  )
}

export function TripSelectField<T extends FieldValues>({
  label = "Trip",
  ...props
}: PickerFieldProps<T>) {
  return (
    <SearchableSelectField
      label={label}
      placeholder="Search by code, title or customer…"
      emptyText="No trips found"
      {...props}
      queryKey={qk.bookings.options()}
      fetchOptions={async (query) => unwrapAction(await fetchBookingOptions(query))}
    />
  )
}

export function PackageSelectField<T extends FieldValues>({
  label = "Package",
  ...props
}: PickerFieldProps<T>) {
  return (
    <SearchableSelectField
      label={label}
      placeholder="Search by code, title or destination…"
      emptyText="No packages found"
      {...props}
      queryKey={qk.itineraries.options()}
      fetchOptions={async (query) => unwrapAction(await fetchPackageOptions(query))}
    />
  )
}

export function EmployeeSelectField<T extends FieldValues>({
  label = "Employee",
  ...props
}: PickerFieldProps<T>) {
  return (
    <SearchableSelectField
      label={label}
      placeholder="Search by name or code…"
      emptyText="No employees found"
      {...props}
      queryKey={qk.hrms.employeeOptions()}
      fetchOptions={async (query) => unwrapAction(await fetchEmployeeOptions(query))}
    />
  )
}
