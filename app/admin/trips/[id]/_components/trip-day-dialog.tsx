"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
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
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import { TripDaySchema, type TripDayValues } from "@/validations/booking.validation"
import { HOTEL_SUPPLIER_TYPES } from "@/validations/supplier.validation"
import type { BookingDay } from "@/db/schemas/booking.schema"
import { fetchSupplierOptions } from "@/app/admin/suppliers/actions"
import { saveTripDay, updateTripDay } from "../../actions"

export function TripDayDialog({
  open,
  onOpenChange,
  bookingId,
  day,
  nextDayNumber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  day?: BookingDay | null
  nextDayNumber: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <TripDayForm
            key={day?.id ?? `new-${nextDayNumber}`}
            bookingId={bookingId}
            day={day ?? null}
            nextDayNumber={nextDayNumber}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TripDayForm({
  bookingId,
  day,
  nextDayNumber,
  onDone,
  onCancel,
}: {
  bookingId: string
  day: BookingDay | null
  nextDayNumber: number
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(day)

  const { data: hotels } = useQuery({
    queryKey: qk.suppliers.options([...HOTEL_SUPPLIER_TYPES]),
    queryFn: async () =>
      unwrapAction(await fetchSupplierOptions({ type: [...HOTEL_SUPPLIER_TYPES] })),
    staleTime: 5 * 60 * 1000,
  })

  const defaultValues = React.useMemo<TripDayValues>(
    () => ({
      bookingId,
      dayNumber: day?.dayNumber ?? nextDayNumber,
      title: day?.title ?? "",
      description: day?.description ?? "",
      hotelSupplierId: day?.hotelSupplierId ?? null,
      stayNote: day?.stayNote ?? "",
      breakfast: day?.breakfast ?? false,
      lunch: day?.lunch ?? false,
      dinner: day?.dinner ?? false,
    }),
    [bookingId, day, nextDayNumber]
  )

  const { form, onSubmit, isPending } = useCrudForm<TripDayValues>({
    schema: TripDaySchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      day
        ? updateTripDay({ ...values, id: day.id } as never)
        : saveTripDay({ ...values, bookingId } as never),
    successMessage: isEdit ? "Day updated" : "Day added",
    invalidate: [qk.bookings.days(bookingId)],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? `Edit day ${day?.dayNumber}` : "Add day"}</DialogTitle>
        <DialogDescription>
          Where the group is and where they're staying, day by day.
        </DialogDescription>
      </DialogHeader>

      <form id="trip-day-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <NumberField
              control={form.control}
              name="dayNumber"
              label="Day"
              min={1}
              disabled={isEdit}
            />
            <TextField
              control={form.control}
              name="title"
              label="Title"
              placeholder="Arrival in Kochi & drive to Munnar"
              autoFocus
            />
          </div>

          <TextareaField
            control={form.control}
            name="description"
            label="What happens"
            rows={4}
            placeholder="Pick up from Kochi airport, drive through the tea plantations…"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="hotelSupplierId"
              label="Overnight stay"
              nullable
              placeholder="No hotel selected"
              options={(hotels ?? []).map((h) => ({
                value: h.id,
                label: h.city ? `${h.name} (${h.city})` : h.name,
              }))}
              description="Add the hotel from Suppliers if it isn't listed."
            />
            <TextField
              control={form.control}
              name="stayNote"
              label="Stay notes"
              placeholder="Deluxe room with balcony"
            />
          </div>

          <FieldSet>
            <FieldLabel>Meals included</FieldLabel>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["breakfast", "Breakfast"],
                  ["lunch", "Lunch"],
                  ["dinner", "Dinner"],
                ] as const
              ).map(([name, label]) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="w-auto">
                      <Checkbox
                        id={`trip-meal-${name}`}
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                      />
                      <FieldLabel htmlFor={`trip-meal-${name}`} className="font-normal">
                        {label}
                      </FieldLabel>
                    </Field>
                  )}
                />
              ))}
            </div>
          </FieldSet>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="trip-day-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save day" : "Add day"}
        </Button>
      </DialogFooter>
    </>
  )
}
