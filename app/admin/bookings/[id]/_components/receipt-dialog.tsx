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
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { formatMoney, toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  CreateReceiptSchema,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  type CreateReceiptValues,
} from "@/validations/accounts.validation"
import { createReceipt } from "@/app/admin/accounts-actions"

const MODE_OPTIONS = optionsFrom(PAYMENT_MODES, PAYMENT_MODE_LABELS)

export function ReceiptDialog({
  open,
  onOpenChange,
  bookingId,
  balance,
  isFirstPayment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  balance: number
  isFirstPayment: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <ReceiptForm
            bookingId={bookingId}
            balance={balance}
            isFirstPayment={isFirstPayment}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReceiptForm({
  bookingId,
  balance,
  isFirstPayment,
  onDone,
  onCancel,
}: {
  bookingId: string
  balance: number
  isFirstPayment: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const defaultValues = React.useMemo<CreateReceiptValues>(
    () => ({
      bookingId,
      invoiceId: null,
      amount: "",
      mode: "upi",
      reference: "",
      receivedAt: new Date().toISOString().slice(0, 10),
      // The first payment on a trip is the advance nine times out of ten.
      isAdvance: isFirstPayment,
      notes: "",
    }),
    [bookingId, isFirstPayment]
  )

  const { form, onSubmit, isPending } = useCrudForm<CreateReceiptValues>({
    schema: CreateReceiptSchema,
    defaultValues: defaultValues as never,
    action: (values) => createReceipt({ ...values, bookingId } as never),
    successMessage: "Payment recorded",
    invalidate: [qk.bookings.all, qk.accounts.all, qk.reports.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          Balance due on this trip is{" "}
          <span className="font-medium text-foreground">{formatMoney(balance)}</span>.
        </DialogDescription>
      </DialogHeader>

      <form id="receipt-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              control={form.control}
              name="amount"
              label="Amount received (₹)"
              autoFocus
            />
            <SelectField
              control={form.control}
              name="mode"
              label="Mode"
              options={MODE_OPTIONS}
            />
            <DateField control={form.control} name="receivedAt" label="Received on" />
            <TextField
              control={form.control}
              name="reference"
              label="Reference"
              placeholder="UTR / cheque no."
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => form.setValue("amount", String(toRupees(balance)) as never)}
          >
            Fill full balance
          </Button>

          <SwitchField
            control={form.control}
            name="isAdvance"
            label="This is the advance"
            description="Tracked separately so advance-collected reports stay accurate."
          />

          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="receipt-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Record payment
        </Button>
      </DialogFooter>
    </>
  )
}
