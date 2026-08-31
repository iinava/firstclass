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
  MoneyField,
  NumberField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import { toRupees } from "@/lib/money"
import {
  OWNERSHIP,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  VehicleFormSchema,
  type VehicleFormValues,
} from "@/validations/vehicle.validation"
import type { VehicleListRow } from "@/lib/services/vehicle.service"
import { fetchSupplierOptions } from "@/app/admin/suppliers/actions"
import { createVehicle, fetchDrivers, updateVehicle } from "../actions"

const TYPE_OPTIONS = optionsFrom(VEHICLE_TYPES, VEHICLE_TYPE_LABELS)
const OWNERSHIP_OPTIONS = optionsFrom(OWNERSHIP, {
  owned: "Owned",
  hired: "Hired",
})

const EMPTY: VehicleFormValues = {
  regNumber: "",
  type: "suv",
  make: "",
  model: "",
  seatingCapacity: 4,
  ownership: "owned",
  supplierId: null,
  defaultDriverId: null,
  ratePerKm: "",
  ratePerDay: "",
  mileageKmpl: undefined,
  fuelPricePerLitre: "",
  insuranceExpiry: "",
  fitnessExpiry: "",
  pucExpiry: "",
  isActive: true,
  notes: "",
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: VehicleListRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <VehicleForm
            key={vehicle?.id ?? "new"}
            vehicle={vehicle ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function VehicleForm({
  vehicle,
  onDone,
  onCancel,
}: {
  vehicle: VehicleListRow | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(vehicle)

  const { data: drivers } = useQuery({
    queryKey: qk.drivers.list(),
    queryFn: async () => unwrapAction(await fetchDrivers({ search: undefined })),
    staleTime: 5 * 60 * 1000,
  })

  const { data: transporters } = useQuery({
    queryKey: qk.suppliers.options(),
    queryFn: async () => unwrapAction(await fetchSupplierOptions({ type: "transport" })),
    staleTime: 5 * 60 * 1000,
  })

  const defaultValues = React.useMemo<VehicleFormValues>(
    () =>
      vehicle
        ? {
            regNumber: vehicle.regNumber,
            type: vehicle.type,
            make: vehicle.make ?? "",
            model: vehicle.model ?? "",
            seatingCapacity: vehicle.seatingCapacity,
            ownership: vehicle.ownership,
            supplierId: vehicle.supplierId,
            defaultDriverId: vehicle.defaultDriverId,
            ratePerKm: vehicle.ratePerKm ? String(toRupees(vehicle.ratePerKm)) : "",
            ratePerDay: vehicle.ratePerDay ? String(toRupees(vehicle.ratePerDay)) : "",
            mileageKmpl: vehicle.mileageKmpl ?? undefined,
            fuelPricePerLitre: vehicle.fuelPricePerLitre
              ? String(toRupees(vehicle.fuelPricePerLitre))
              : "",
            insuranceExpiry: vehicle.insuranceExpiry ?? "",
            fitnessExpiry: vehicle.fitnessExpiry ?? "",
            pucExpiry: vehicle.pucExpiry ?? "",
            isActive: vehicle.isActive,
            notes: vehicle.notes ?? "",
          }
        : EMPTY,
    [vehicle]
  )

  const { form, onSubmit, isPending } = useCrudForm<VehicleFormValues>({
    schema: VehicleFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      vehicle
        ? updateVehicle({ ...values, id: vehicle.id } as never)
        : createVehicle(values as never),
    successMessage: isEdit ? "Vehicle updated" : "Vehicle added",
    invalidate: [qk.vehicles.all],
    onSuccess: onDone,
  })

  const ownership = form.watch("ownership")

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
        <DialogDescription>
          Standing rates pre-fill transport cost lines; actuals are still logged per trip.
        </DialogDescription>
      </DialogHeader>

      <form id="vehicle-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="regNumber"
              label="Registration number"
              placeholder="KL07AB1234"
              autoFocus
            />
            <SelectField
              control={form.control}
              name="type"
              label="Type"
              options={TYPE_OPTIONS}
            />
            <TextField control={form.control} name="make" label="Make" placeholder="Toyota" />
            <TextField control={form.control} name="model" label="Model" placeholder="Innova" />
            <NumberField
              control={form.control}
              name="seatingCapacity"
              label="Seats"
              min={1}
              max={80}
            />
            <SelectField
              control={form.control}
              name="ownership"
              label="Ownership"
              options={OWNERSHIP_OPTIONS}
            />

            {ownership === "hired" && (
              <SelectField
                control={form.control}
                name="supplierId"
                label="Hired from"
                nullable
                placeholder="Select transporter"
                options={(transporters ?? []).map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
              />
            )}

            <SelectField
              control={form.control}
              name="defaultDriverId"
              label="Default driver"
              nullable
              placeholder="No default"
              options={(drivers ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />

            <MoneyField control={form.control} name="ratePerKm" label="Rate per km (₹)" />
            <MoneyField control={form.control} name="ratePerDay" label="Rate per day (₹)" />
            <NumberField
              control={form.control}
              name="mileageKmpl"
              label="Mileage (km/l)"
              min={0}
              max={200}
            />
            <MoneyField
              control={form.control}
              name="fuelPricePerLitre"
              label="Fuel price per litre (₹)"
            />
          </div>

          <div className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-3">
            <DateField
              control={form.control}
              name="insuranceExpiry"
              label="Insurance expiry"
            />
            <DateField
              control={form.control}
              name="fitnessExpiry"
              label="Fitness expiry"
            />
            <DateField control={form.control} name="pucExpiry" label="PUC expiry" />
          </div>

          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
          <SwitchField
            control={form.control}
            name="isActive"
            label="Active"
            description="Inactive vehicles can't be assigned to new trips."
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="vehicle-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Add vehicle"}
        </Button>
      </DialogFooter>
    </>
  )
}
