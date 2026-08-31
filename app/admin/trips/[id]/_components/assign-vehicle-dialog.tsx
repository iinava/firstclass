"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
import { differenceInCalendarDays } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  DateField,
  MoneyField,
  NumberField,
  SelectField,
  TextareaField,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { formatMoney, toPaise, toRupees } from "@/lib/money"
import { parseDate } from "@/lib/format"
import { qk } from "@/lib/query-keys"
import {
  AssignVehicleSchema,
  type AssignVehicleValues,
} from "@/validations/vehicle.validation"
import { assignVehicle, fetchDrivers, fetchVehicleOptions } from "@/app/admin/fleet/actions"

function daysBetween(startDate: string, endDate: string): number {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (!start || !end) return 1
  return Math.max(1, differenceInCalendarDays(end, start) + 1)
}

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
      addTransportCost: true,
      costDays: daysBetween(startDate, endDate),
      costPerDay: "",
    }),
    [bookingId, startDate, endDate]
  )

  const { form, onSubmit, isPending } = useCrudForm<AssignVehicleValues>({
    schema: AssignVehicleSchema,
    defaultValues: defaultValues as never,
    action: (values) => assignVehicle({ ...values, bookingId } as never),
    successMessage: "Vehicle assigned",
    invalidate: [qk.vehicles.all, qk.bookings.all, qk.reports.all],
    onSuccess: onDone,
  })

  const values = form.watch()
  const addTransportCost = Boolean(values.addTransportCost)

  // Picking a vehicle pre-fills its standing per-day rate — the whole point
  // of that field existing on the vehicle record — and the day range comes
  // straight from the dates already on this form, so nothing has to be
  // re-typed on a separate "Add cost" screen afterwards.
  const selectedVehicle = vehicles?.find((v) => v.id === values.vehicleId)
  React.useEffect(() => {
    if (selectedVehicle?.ratePerDay) {
      form.setValue("costPerDay", String(toRupees(selectedVehicle.ratePerDay)), {
        shouldDirty: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id])

  React.useEffect(() => {
    form.setValue("costDays", daysBetween(values.startDate as string, values.endDate as string))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startDate, values.endDate])

  const costTotal = toPaise(values.costPerDay as string) * Number(values.costDays || 0)

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

          <div className="rounded-lg border border-dashed p-4">
            <Controller
              control={form.control}
              name="addTransportCost"
              render={({ field }) => (
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id="add-transport-cost"
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                  />
                  <FieldLabel htmlFor="add-transport-cost" className="font-normal">
                    Add a transport cost for this vehicle
                  </FieldLabel>
                </Field>
              )}
            />

            {addTransportCost && (
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    control={form.control}
                    name="costDays"
                    label="Days"
                    min={1}
                  />
                  <MoneyField
                    control={form.control}
                    name="costPerDay"
                    label="Rate per day (₹)"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Transport cost</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(costTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

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
