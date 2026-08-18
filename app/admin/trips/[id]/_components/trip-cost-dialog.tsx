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
  TextField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { formatMoney, toPaise, toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  TripCostFormSchema,
  type TripCostValues,
} from "@/validations/booking.validation"
import type { TripCostRow } from "@/lib/services/booking.service"
import { fetchSupplierOptions } from "@/app/admin/suppliers/actions"
import { fetchVehicleOptions } from "@/app/admin/fleet/actions"
import { createTripCost, updateTripCost } from "../../actions"

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
  const lineTotal = toPaise(values.unitCost as string) * Number(values.quantity || 0)
  const showVehicle = VEHICLE_CATEGORIES.has(values.category as string)

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

          <TextField
            control={form.control}
            name="description"
            label="Description"
            placeholder="2 deluxe rooms, Tea Valley Resort"
            autoFocus
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              control={form.control}
              name="quantity"
              label="Qty / nights"
              min={1}
            />
            <MoneyField control={form.control} name="unitCost" label="Unit cost (₹)" />
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
