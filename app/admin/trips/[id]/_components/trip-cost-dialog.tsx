"use client"

import * as React from "react"
import { differenceInCalendarDays } from "date-fns"
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
  TextField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { parseDate } from "@/lib/format"
import { formatMoney, toPaise, toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  COST_QUANTITY_CONFIG,
  TripCostFormSchema,
  type TripCostValues,
} from "@/validations/booking.validation"
import type { TripCostRow } from "@/lib/services/booking.service"
import { fetchSupplierOptions, fetchSupplierRates } from "@/app/admin/suppliers/actions"
import { fetchAssignments, fetchVehicleOptions } from "@/app/admin/fleet/actions"
import { createTripCost, fetchTripDays, updateTripCost } from "../../actions"

const CATEGORY_OPTIONS = optionsFrom(COST_CATEGORIES, COST_CATEGORY_LABELS)

/** Transport-ish categories get the vehicle picker instead of a supplier. */
const VEHICLE_CATEGORIES = new Set(["transport", "fuel", "toll_parking", "driver_allowance"])

export function TripCostDialog({
  open,
  onOpenChange,
  bookingId,
  cost,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  cost?: TripCostRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <TripCostForm
            key={cost?.id ?? "new"}
            bookingId={bookingId}
            cost={cost ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TripCostForm({
  bookingId,
  cost,
  onDone,
  onCancel,
}: {
  bookingId: string
  cost: TripCostRow | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(cost)

  const { data: suppliers } = useQuery({
    queryKey: qk.suppliers.options(),
    queryFn: async () => unwrapAction(await fetchSupplierOptions({ type: undefined })),
    staleTime: 5 * 60 * 1000,
  })

  const { data: vehicles } = useQuery({
    queryKey: qk.vehicles.list({ options: true }),
    queryFn: async () => unwrapAction(await fetchVehicleOptions()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: assignments } = useQuery({
    queryKey: qk.vehicles.availability({ bookingId }),
    queryFn: async () => unwrapAction(await fetchAssignments({ bookingId })),
    staleTime: 60 * 1000,
  })

  const defaultValues = React.useMemo<TripCostValues>(
    () => ({
      bookingId,
      category: cost?.category ?? "hotel",
      supplierId: cost?.supplierId ?? null,
      vehicleId: cost?.vehicleId ?? null,
      description: cost?.description ?? "",
      serviceDate: cost?.serviceDate ?? "",
      quantity: cost?.quantity ?? 1,
      unitCost: cost ? String(toRupees(cost.unitCost)) : "",
      sellAmount: cost ? String(toRupees(cost.sellAmount)) : "0",
      status: cost?.status ?? "planned",
      confirmationNo: cost?.confirmationNo ?? "",
      notes: cost?.notes ?? "",
    }),
    [bookingId, cost]
  )

  const { form, onSubmit, isPending } = useCrudForm<TripCostValues>({
    schema: TripCostFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      cost
        ? updateTripCost({ ...values, id: cost.id } as never)
        : createTripCost(values as never),
    successMessage: isEdit ? "Cost updated" : "Cost added",
    invalidate: [qk.bookings.all, qk.reports.all],
    onSuccess: onDone,
  })

  const values = form.watch()
  const showVehicle = VEHICLE_CATEGORIES.has(values.category as string)

  // The supplier's own rate card is exactly what "unit cost" and
  // "description" should come from — without this, staff re-type a number
  // that's already sitting on the supplier record.
  const supplierId = values.supplierId as string | null | undefined
  const { data: supplierRates } = useQuery({
    queryKey: qk.suppliers.rates(supplierId ?? ""),
    queryFn: async () => unwrapAction(await fetchSupplierRates({ supplierId: supplierId! })),
    enabled: !showVehicle && Boolean(supplierId),
    staleTime: 60 * 1000,
  })

  // The hotel for each night is already picked on the Itinerary tab — a
  // "hotel" cost line billing a different property with nothing tying the
  // two together is how the two records quietly drift apart.
  const { data: tripDays } = useQuery({
    queryKey: qk.bookings.days(bookingId),
    queryFn: async () => unwrapAction(await fetchTripDays({ bookingId })),
    enabled: values.category === "hotel",
    staleTime: 60 * 1000,
  })
  const dayHotels = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const day of tripDays ?? []) {
      if (day.hotelSupplierId && day.hotelName) seen.set(day.hotelSupplierId, day.hotelName)
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [tripDays])
  const quantityConfig =
    COST_QUANTITY_CONFIG[values.category as keyof typeof COST_QUANTITY_CONFIG]
  const lineTotal = quantityConfig?.show
    ? toPaise(values.unitCost as string) * Number(values.quantity || 0)
    : toPaise(values.unitCost as string)

  // A category with no meaningful quantity (a toll, a flat misc charge) is
  // always exactly one line — force it back to 1 if a previous category left
  // some other value sitting in the field.
  React.useEffect(() => {
    if (!quantityConfig?.show && values.quantity !== 1) {
      form.setValue("quantity", 1, { shouldValidate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantityConfig?.show])

  // Fuel cost = distance driven ÷ mileage (km/l) × fuel price per litre. Only
  // computable once the vehicle has a logged odometer reading for this trip.
  const mileageSuggestion = React.useMemo(() => {
    if (values.category !== "fuel" || !values.vehicleId) return null
    const vehicle = vehicles?.find((v) => v.id === values.vehicleId)
    if (!vehicle?.mileageKmpl || !vehicle.fuelPricePerLitre) return null

    const assignment = assignments?.find((a) => a.vehicleId === values.vehicleId)
    if (!assignment?.startOdometer || !assignment.endOdometer) return null

    const distanceKm = assignment.endOdometer - assignment.startOdometer
    if (distanceKm <= 0) return null

    const litres = distanceKm / vehicle.mileageKmpl
    const cost = Math.round(litres * vehicle.fuelPricePerLitre)
    return { distanceKm, litres, cost }
  }, [values.category, values.vehicleId, vehicles, assignments])

  // Transport cost = the vehicle's own standing day-rate × however many days
  // it's actually assigned to this trip — the same numbers already sitting on
  // the vehicle record and its assignment, so picking the vehicle should be
  // enough instead of retyping both by hand.
  const transportSuggestion = React.useMemo(() => {
    if (values.category !== "transport" || !values.vehicleId) return null
    const vehicle = vehicles?.find((v) => v.id === values.vehicleId)
    if (!vehicle?.ratePerDay) return null

    const assignment = assignments?.find((a) => a.vehicleId === values.vehicleId)
    const start = parseDate(assignment?.startDate)
    const end = parseDate(assignment?.endDate)
    const days =
      start && end ? Math.max(1, differenceInCalendarDays(end, start) + 1) : 1

    return { days, ratePerDay: vehicle.ratePerDay, cost: vehicle.ratePerDay * days }
  }, [values.category, values.vehicleId, vehicles, assignments])

  // Applies as soon as the vehicle is picked, not only after a manual "Use
  // this" click — a blank quantity/rate right after selecting the vehicle
  // is exactly the "nothing happened" gap this closes. Still overridable —
  // it only fires while the fields are untouched.
  React.useEffect(() => {
    if (!transportSuggestion) return
    if (Number(values.quantity) === 1 && !values.unitCost) {
      form.setValue("quantity", transportSuggestion.days, { shouldDirty: true })
      form.setValue("unitCost", String(toRupees(transportSuggestion.ratePerDay)), {
        shouldDirty: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportSuggestion?.days, transportSuggestion?.ratePerDay])

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit cost line" : "Add cost"}</DialogTitle>
        <DialogDescription>
          Record what this costs the business. Sell price is only needed when the item is
          charged on top of the package.
        </DialogDescription>
      </DialogHeader>

      <form id="trip-cost-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="category"
              label="Category"
              options={CATEGORY_OPTIONS}
            />
            <SelectField
              control={form.control}
              name="status"
              label="Status"
              options={[
                { value: "planned", label: "Planned" },
                { value: "booked", label: "Booked" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />

            {showVehicle ? (
              <SelectField
                control={form.control}
                name="vehicleId"
                label="Vehicle"
                nullable
                placeholder="Not vehicle-specific"
                options={(vehicles ?? []).map((v) => ({
                  value: v.id,
                  label: `${v.regNumber} (${v.seatingCapacity} seats)`,
                }))}
              />
            ) : (
              <SelectField
                control={form.control}
                name="supplierId"
                label="Supplier"
                nullable
                placeholder="No supplier"
                options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            )}

            <DateField control={form.control} name="serviceDate" label="Service date" />
          </div>

          {values.category === "hotel" && dayHotels.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Already on the itinerary:</span>
              {dayHotels.map((hotel) => (
                <Button
                  key={hotel.id}
                  type="button"
                  size="sm"
                  variant={values.supplierId === hotel.id ? "default" : "outline"}
                  onClick={() => form.setValue("supplierId", hotel.id, { shouldDirty: true })}
                >
                  {hotel.name}
                </Button>
              ))}
            </div>
          )}

          <TextField
            control={form.control}
            name="description"
            label="Description"
            placeholder="2 deluxe rooms, Tea Valley Resort"
            autoFocus
          />

          {!isEdit && supplierRates && supplierRates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Rate card:</span>
              {supplierRates.map((rate) => (
                <Button
                  key={rate.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    form.setValue("description", rate.title, { shouldDirty: true })
                    form.setValue("unitCost", String(toRupees(rate.rate)), {
                      shouldDirty: true,
                    })
                  }}
                >
                  {rate.title} — {formatMoney(rate.rate)} {rate.unit}
                </Button>
              ))}
            </div>
          )}

          {mileageSuggestion && (
            <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {mileageSuggestion.distanceKm} km driven ÷ mileage ≈{" "}
                {mileageSuggestion.litres.toFixed(1)} L — est.{" "}
                {formatMoney(mileageSuggestion.cost)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  form.setValue("quantity", 1, { shouldDirty: true })
                  form.setValue(
                    "unitCost",
                    String(toRupees(mileageSuggestion.cost)),
                    { shouldDirty: true }
                  )
                }}
              >
                Use this
              </Button>
            </div>
          )}

          {transportSuggestion && (
            <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {transportSuggestion.days} day{transportSuggestion.days === 1 ? "" : "s"} ×{" "}
                {formatMoney(transportSuggestion.ratePerDay)}/day — est.{" "}
                {formatMoney(transportSuggestion.cost)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  form.setValue("quantity", transportSuggestion.days, { shouldDirty: true })
                  form.setValue(
                    "unitCost",
                    String(toRupees(transportSuggestion.ratePerDay)),
                    { shouldDirty: true }
                  )
                }}
              >
                Use this
              </Button>
            </div>
          )}

          <div className={cn("grid gap-4", quantityConfig?.show ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {quantityConfig?.show && (
              <NumberField
                control={form.control}
                name="quantity"
                label={quantityConfig.label}
                min={1}
              />
            )}
            <MoneyField
              control={form.control}
              name="unitCost"
              label={quantityConfig?.show ? "Unit cost (₹)" : "Amount (₹)"}
            />
            <MoneyField
              control={form.control}
              name="sellAmount"
              label="Charged to customer (₹)"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-sm">
            <span className="text-muted-foreground">Line cost</span>
            <span className="font-semibold tabular-nums">{formatMoney(lineTotal)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="confirmationNo"
              label="Confirmation no."
              placeholder="Optional"
            />
          </div>

          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="trip-cost-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Add cost"}
        </Button>
      </DialogFooter>
    </>
  )
}
