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
import { CustomerPicker } from "@/components/shared/customer-picker"
import {
  DateField,
  MoneyField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { computeTotals, formatMoney, percentToBps, toPaise, toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  BookingFormSchema,
  type BookingFormValues,
} from "@/validations/booking.validation"
import type { BookingListRow } from "@/lib/services/booking.service"
import { fetchAssignableUsers } from "@/app/admin/leads/actions"
import { fetchPackageOptions } from "@/app/admin/packages/actions"
import { createBooking, updateBooking } from "../actions"

const todayISO = () => new Date().toISOString().slice(0, 10)

const EMPTY: BookingFormValues = {
  customerId: "",
  leadId: null,
  itineraryId: null,
  title: "",
  destination: "",
  startDate: todayISO(),
  endDate: todayISO(),
  adults: 1,
  children: 0,
  infants: 0,
  pricingMode: "fixed",
  pricePerAdult: "",
  pricePerChild: "",
  sellSubtotal: "",
  discount: "0",
  taxRatePercent: 5,
  assignedTo: null,
  notes: "",
  internalNotes: "",
}

/**
 * Everything the enquiry already knows, so converting one is a review-and-confirm
 * rather than a re-type. Shape is a subset of LeadListRow.
 */
export interface TripFromLead {
  id: string
  code: string
  customerId: string
  customerName: string
  destination: string | null
  travelDate: string | null
  adults: number
  children: number
  budget: number | null
  requirements: string | null
  assignedTo: string | null
}

export function TripFormDialog({
  open,
  onOpenChange,
  booking,
  presetCustomerId,
  fromLead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking?: BookingListRow | null
  presetCustomerId?: string
  /** Set to convert an enquiry — every field is pre-filled from it. */
  fromLead?: TripFromLead | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <TripForm
            key={booking?.id ?? fromLead?.id ?? "new"}
            booking={booking ?? null}
            presetCustomerId={presetCustomerId}
            fromLead={fromLead ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TripForm({
  booking,
  presetCustomerId,
  fromLead,
  onDone,
  onCancel,
}: {
  booking: BookingListRow | null
  presetCustomerId?: string
  fromLead: TripFromLead | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(booking)

  const { data: assignees } = useQuery({
    queryKey: qk.users.options(),
    queryFn: async () => unwrapAction(await fetchAssignableUsers()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: packages } = useQuery({
    queryKey: qk.itineraries.options(),
    queryFn: async () => unwrapAction(await fetchPackageOptions()),
    staleTime: 5 * 60 * 1000,
  })

  const defaultValues = React.useMemo<BookingFormValues>(() => {
    if (booking) {
      return {
        ...EMPTY,
        customerId: booking.customerId,
        itineraryId: booking.itineraryId,
        title: booking.title,
        destination: booking.destination ?? "",
        startDate: booking.startDate,
        endDate: booking.endDate,
        adults: booking.adults,
        children: booking.children,
        infants: booking.infants,
        pricingMode: "fixed",
        sellSubtotal: String(toRupees(booking.grandTotal)),
        discount: "0",
        taxRatePercent: 0,
      }
    }

    if (fromLead) {
      // The enquiry's travel date seeds both ends — the agent adjusts the return
      // date, which is faster than typing two dates from scratch.
      const start = fromLead.travelDate ?? todayISO()
      return {
        ...EMPTY,
        customerId: fromLead.customerId,
        leadId: fromLead.id,
        title: fromLead.destination
          ? `${fromLead.destination} trip`
          : `Trip for ${fromLead.customerName}`,
        destination: fromLead.destination ?? "",
        startDate: start,
        endDate: start,
        adults: fromLead.adults || 1,
        children: fromLead.children,
        // The quoted budget is the natural opening price.
        sellSubtotal: fromLead.budget ? String(toRupees(fromLead.budget)) : "",
        assignedTo: fromLead.assignedTo,
        notes: fromLead.requirements ?? "",
      }
    }

    return { ...EMPTY, customerId: presetCustomerId ?? "" }
  }, [booking, presetCustomerId, fromLead])

  const { form, onSubmit, isPending } = useCrudForm<BookingFormValues>({
    schema: BookingFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      booking
        ? updateBooking({ ...values, id: booking.id } as never)
        : createBooking(values as never),
    successMessage: isEdit
      ? "Trip updated"
      : fromLead
        ? "Enquiry converted to trip"
        : "Trip created",
    invalidate: [qk.bookings.all, qk.leads.all, qk.followups.all, qk.reports.all],
    onSuccess: onDone,
  })

  const values = form.watch()

  // Mirrors the server-side pricing exactly so the figure shown before saving
  // is the figure that gets stored.
  const preview = React.useMemo(() => {
    const subtotal =
      values.pricingMode === "per_pax"
        ? toPaise(values.pricePerAdult as string) * Number(values.adults || 0) +
          toPaise(values.pricePerChild as string) * Number(values.children || 0)
        : toPaise(values.sellSubtotal as string)

    return computeTotals({
      subtotal,
      discount: toPaise(values.discount as string),
      taxRateBps: percentToBps(Number(values.taxRatePercent || 0)),
    })
  }, [
    values.pricingMode,
    values.pricePerAdult,
    values.pricePerChild,
    values.sellSubtotal,
    values.discount,
    values.taxRatePercent,
    values.adults,
    values.children,
  ])

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit trip" : fromLead ? "Convert enquiry to trip" : "New trip"}
        </DialogTitle>
        <DialogDescription>
          {fromLead
            ? `Pre-filled from ${fromLead.code}. Check the dates and price, then confirm — the enquiry is marked won.`
            : "Costs are added afterwards on the trip page."}
        </DialogDescription>
      </DialogHeader>

      <form id="trip-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <CustomerPicker control={form.control} name="customerId" />

          <SelectField
            control={form.control}
            name="itineraryId"
            label="Package"
            nullable
            placeholder="No package — custom trip"
            options={(packages ?? []).map((p) => ({
              value: p.id,
              label: `${p.code} — ${p.title}${p.destination ? ` (${p.destination})` : ""}`,
            }))}
            description="Selecting a package copies its day-by-day plan onto this trip, editable afterwards."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="title"
              label="Trip name"
              placeholder="Munnar & Alleppey 4N/5D"
            />
            <TextField
              control={form.control}
              name="destination"
              label="Destination"
              placeholder="Munnar, Alleppey"
            />
            <DateField control={form.control} name="startDate" label="Start date" />
            <DateField control={form.control} name="endDate" label="End date" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField control={form.control} name="adults" label="Adults" min={1} />
            <NumberField control={form.control} name="children" label="Children" min={0} />
            <NumberField control={form.control} name="infants" label="Infants" min={0} />
          </div>

          <div className="rounded-lg border border-dashed p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="pricingMode"
                label="Pricing"
                options={[
                  { value: "fixed", label: "Fixed package price" },
                  { value: "per_pax", label: "Per person" },
                ]}
              />

              {values.pricingMode === "per_pax" ? (
                <>
                  <MoneyField
                    control={form.control}
                    name="pricePerAdult"
                    label="Price per adult (₹)"
                  />
                  <MoneyField
                    control={form.control}
                    name="pricePerChild"
                    label="Price per child (₹)"
                  />
                </>
              ) : (
                <MoneyField
                  control={form.control}
                  name="sellSubtotal"
                  label="Package price (₹)"
                />
              )}

              <MoneyField control={form.control} name="discount" label="Discount (₹)" />
              <NumberField
                control={form.control}
                name="taxRatePercent"
                label="GST %"
                min={0}
                max={50}
              />
            </div>

            <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(preview.subtotal)}</dd>
              </div>
              {preview.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="tabular-nums text-red-500">
                    −{formatMoney(preview.discount)}
                  </dd>
                </div>
              )}
              {preview.taxAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    GST ({String(values.taxRatePercent)}%)
                  </dt>
                  <dd className="tabular-nums">{formatMoney(preview.taxAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(preview.grandTotal)}</dd>
              </div>
            </dl>
          </div>

          <SelectField
            control={form.control}
            name="assignedTo"
            label="Handled by"
            nullable
            placeholder="Me"
            options={(assignees ?? []).map((u) => ({ value: u.id, label: u.name }))}
          />

          <TextareaField
            control={form.control}
            name="notes"
            label="Customer notes"
            rows={2}
            placeholder="Shown on the invoice and vouchers"
          />
          <TextareaField
            control={form.control}
            name="internalNotes"
            label="Internal notes"
            rows={2}
            placeholder="Only visible to staff"
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="trip-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : fromLead ? "Convert to trip" : "Create trip"}
        </Button>
      </DialogFooter>
    </>
  )
}
