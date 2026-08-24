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
import { MoneyField, TextareaField } from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import { CancelBookingSchema } from "@/validations/booking.validation"
import { z } from "zod"
import { cancelBooking } from "../../actions"

type CancelBookingValues = z.input<typeof CancelBookingSchema>

export function CancelBookingDialog({
  open,
  onOpenChange,
  bookingId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <CancelBookingForm
            bookingId={bookingId}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CancelBookingForm({
  bookingId,
  onDone,
  onCancel,
}: {
  bookingId: string
  onDone: () => void
  onCancel: () => void
}) {
  const defaultValues = React.useMemo<CancelBookingValues>(
    () => ({ id: bookingId, cancellationReason: "", cancellationCharge: null }),
    [bookingId]
  )

  const { form, onSubmit, isPending } = useCrudForm<CancelBookingValues>({
    schema: CancelBookingSchema,
    defaultValues: defaultValues as never,
    action: (values) => cancelBooking(values as never),
    successMessage: "Booking cancelled",
    invalidate: [qk.bookings.all, qk.reports.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cancel this trip?</DialogTitle>
        <DialogDescription>
          A cancelled trip can no longer be edited or have its status changed. This does not
          delete any payments already recorded — record a refund or cancellation charge
          separately if needed.
        </DialogDescription>
      </DialogHeader>

      <form id="cancel-booking-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <TextareaField
            control={form.control}
            name="cancellationReason"
            label="Reason for cancellation"
            placeholder="Customer requested cancellation due to…"
            rows={3}
            autoFocus
          />
          <MoneyField
            control={form.control}
            name="cancellationCharge"
            label="Cancellation charge (₹, optional)"
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Keep trip
        </Button>
        <Button type="submit" form="cancel-booking-form" variant="destructive" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Cancel trip
        </Button>
      </DialogFooter>
    </>
  )
}
