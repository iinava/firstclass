"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
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
  NumberField,
  SelectField,
  TextareaField,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  AssignVehicleSchema,
  type AssignVehicleValues,
} from "@/validations/vehicle.validation"
import { assignVehicle, fetchDrivers, fetchVehicleOptions } from "@/app/admin/fleet/actions"

export function AssignVehicleDialog({
  open,
  onOpenChange,
  bookingId,
  startDate,
  endDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  startDate: string
  endDate: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <AssignForm
            bookingId={bookingId}
            startDate={startDate}
            endDate={endDate}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({
  bookingId,
  startDate,
  endDate,
  onDone,
  onCancel,
}: {
  bookingId: string
  startDate: string
  endDate: string
  onDone: () => void
  onCancel: () => void
}) {
  const { data: vehicles } = useQuery({
    queryKey: qk.vehicles.list({ options: true }),
    queryFn: async () => unwrapAction(await fetchVehicleOptions()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: drivers } = useQuery({
    queryKey: qk.drivers.list(),
    queryFn: async () => unwrapAction(await fetchDrivers({ search: undefined })),
    staleTime: 5 * 60 * 1000,
  })

  const defaultValues = React.useMemo<AssignVehicleValues>(
    () => ({
      bookingId,
      vehicleId: "",
      driverId: null,
      // Defaults to the trip's own dates — the common case.
      startDate,
      endDate,
      startOdometer: null,
      notes: "",
    }),
    [bookingId, startDate, endDate]
  )

  const { form, onSubmit, isPending } = useCrudForm<AssignVehicleValues>({
    schema: AssignVehicleSchema,
    defaultValues: defaultValues as never,
    action: (values) => assignVehicle({ ...values, bookingId } as never),
    successMessage: "Vehicle assigned",
    invalidate: [qk.vehicles.all, qk.bookings.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Assign vehicle</DialogTitle>
        <DialogDescription>
          The vehicle is blocked for these dates. Overlapping assignments are rejected.
        </DialogDescription>
      </DialogHeader>

      <form id="assign-vehicle-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <SelectField
            control={form.control}
            name="vehicleId"
            label="Vehicle"
            placeholder="Select a vehicle"
            options={(vehicles ?? []).map((v) => ({
              value: v.id,
              label: `${v.regNumber} — ${v.seatingCapacity} seats (${v.ownership})`,
            }))}
          />
          <SelectField
            control={form.control}
            name="driverId"
            label="Driver"
            nullable
            placeholder="No driver assigned"
            options={(drivers ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField control={form.control} name="startDate" label="From" />
            <DateField control={form.control} name="endDate" label="To" />
          </div>
          <NumberField
            control={form.control}
            name="startOdometer"
            label="Start odometer (km)"
            min={0}
          />
          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="assign-vehicle-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Assign
        </Button>
      </DialogFooter>
    </>
  )
}
