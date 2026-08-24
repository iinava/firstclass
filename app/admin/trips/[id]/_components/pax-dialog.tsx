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
import { NumberField, TextareaField, TextField } from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import { BookingPaxSchema, type BookingPaxValues } from "@/validations/booking.validation"
import { addPax } from "../../actions"

export function PaxDialog({
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
          <PaxForm bookingId={bookingId} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaxForm({
  bookingId,
  onDone,
  onCancel,
}: {
  bookingId: string
  onDone: () => void
  onCancel: () => void
}) {
  const defaultValues = React.useMemo<BookingPaxValues>(
    () => ({
      bookingId,
      name: "",
      age: null,
      gender: "",
      phone: "",
      idType: "",
      idNumber: "",
      notes: "",
    }),
    [bookingId]
  )

  const { form, onSubmit, isPending } = useCrudForm<BookingPaxValues>({
    schema: BookingPaxSchema,
    defaultValues: defaultValues as never,
    action: (values) => addPax(values as never),
    successMessage: "Passenger added",
    invalidate: [qk.bookings.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add passenger</DialogTitle>
        <DialogDescription>
          Traveller details for this trip — useful for hotel check-ins and travel documents.
        </DialogDescription>
      </DialogHeader>

      <form id="pax-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <TextField control={form.control} name="name" label="Full name" autoFocus />

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField control={form.control} name="age" label="Age" min={0} />
            <TextField control={form.control} name="gender" label="Gender" placeholder="Optional" />
          </div>

          <TextField control={form.control} name="phone" label="Phone" placeholder="Optional" />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="idType"
              label="ID type"
              placeholder="Aadhaar, Passport…"
            />
            <TextField control={form.control} name="idNumber" label="ID number" placeholder="Optional" />
          </div>

          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="pax-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Add passenger
        </Button>
      </DialogFooter>
    </>
  )
}
