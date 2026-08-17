"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  DateField,
  MoneyField,
  SwitchField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import { toRupees } from "@/lib/money"
import { DriverFormSchema, type DriverFormValues } from "@/validations/vehicle.validation"
import type { Driver } from "@/db/schemas/vehicle.schema"
import { createDriver, updateDriver } from "../actions"

const EMPTY: DriverFormValues = {
  name: "",
  phone: "",
  licenseNumber: "",
  licenseExpiry: "",
  address: "",
  dailyAllowance: "",
  isActive: true,
  notes: "",
}

export function DriverFormDialog({
  open,
  onOpenChange,
  driver,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver?: Driver | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {open && (
          <DriverForm
            key={driver?.id ?? "new"}
            driver={driver ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DriverForm({
  driver,
  onDone,
  onCancel,
}: {
  driver: Driver | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(driver)

  const defaultValues = React.useMemo<DriverFormValues>(
    () =>
      driver
        ? {
            name: driver.name,
            phone: driver.phone,
            licenseNumber: driver.licenseNumber ?? "",
            licenseExpiry: driver.licenseExpiry ?? "",
            address: driver.address ?? "",
            dailyAllowance: driver.dailyAllowance
              ? String(toRupees(driver.dailyAllowance))
              : "",
            isActive: driver.isActive,
            notes: driver.notes ?? "",
          }
        : EMPTY,
    [driver]
  )

  const { form, onSubmit, isPending } = useCrudForm<DriverFormValues>({
    schema: DriverFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      driver
        ? updateDriver({ ...values, id: driver.id } as never)
        : createDriver(values as never),
    successMessage: isEdit ? "Driver updated" : "Driver added",
    invalidate: [qk.drivers.all, qk.vehicles.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit driver" : "Add driver"}</DialogTitle>
        <DialogDescription>
          The daily allowance pre-fills the driver bata line on trip costs.
        </DialogDescription>
      </DialogHeader>

      <form id="driver-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Name" autoFocus />
            <TextField
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
            />
            <TextField
              control={form.control}
              name="licenseNumber"
              label="Licence number"
            />
            <DateField
              control={form.control}
              name="licenseExpiry"
              label="Licence expiry"
            />
            <MoneyField
              control={form.control}
              name="dailyAllowance"
              label="Daily allowance (₹)"
              className="sm:col-span-2"
            />
          </div>
          <TextareaField control={form.control} name="address" label="Address" rows={2} />
          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
          <SwitchField control={form.control} name="isActive" label="Active" />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="driver-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Add driver"}
        </Button>
      </DialogFooter>
    </>
  )
}
