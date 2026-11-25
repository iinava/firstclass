"use client"

import * as React from "react"
import type { Control } from "react-hook-form"
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
  UpdateReceiptSchema,
  type CreateReceiptValues,
  type UpdateReceiptValues,
} from "@/validations/accounts.validation"
import { createReceipt, updateReceipt } from "@/app/admin/accounts-actions"

const MODE_OPTIONS = optionsFrom(PAYMENT_MODES, PAYMENT_MODE_LABELS)

/** The fields of a recorded receipt the edit form needs to prefill. */
export interface EditableReceipt {
  id: string
  number: string
  amount: number
  mode: string
  reference: string | null
  receivedAt: string
  isAdvance: boolean
  notes: string | null
}

const INVALIDATE = [qk.bookings.all, qk.accounts.all, qk.reports.all]

export function ReceiptDialog({
  open,
  onOpenChange,
  bookingId,
  balance,
  isFirstPayment,
  receipt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId?: string
  /** Balance still due on the trip, excluding the receipt being edited. */
  balance?: number
  isFirstPayment?: boolean
  /** When set, the dialog corrects this receipt instead of recording a new one. */
  receipt?: EditableReceipt | null
}) {
  const close = () => onOpenChange(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open &&
          (receipt ? (
            <EditReceiptForm
              receipt={receipt}
              balance={balance}
              onDone={close}
              onCancel={close}
            />
          ) : bookingId ? (
            <CreateReceiptForm
              bookingId={bookingId}
              balance={balance ?? 0}
              isFirstPayment={isFirstPayment ?? false}
              onDone={close}
              onCancel={close}
            />
          ) : null)}
      </DialogContent>
    </Dialog>
  )
}

function CreateReceiptForm({
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
      // Settling the balance in full is the common case, so it is pre-filled
      // rather than hidden behind a helper button.
      amount: String(toRupees(balance)),
      mode: "upi",
      reference: "",
      receivedAt: new Date().toISOString().slice(0, 10),
      // The first payment on a trip is the advance nine times out of ten.
      isAdvance: isFirstPayment,
      notes: "",
    }),
    [bookingId, balance, isFirstPayment]
  )

  const { form, onSubmit, isPending } = useCrudForm<CreateReceiptValues>({
    schema: CreateReceiptSchema,
    defaultValues: defaultValues as never,
    action: (values) => createReceipt({ ...values, bookingId } as never),
    successMessage: "Payment recorded",
    invalidate: INVALIDATE,
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

      <ReceiptFields form={form} onSubmit={onSubmit} />

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

function EditReceiptForm({
  receipt,
  balance,
  onDone,
  onCancel,
}: {
  receipt: EditableReceipt
  balance?: number
  onDone: () => void
  onCancel: () => void
}) {
  const defaultValues = React.useMemo<UpdateReceiptValues>(
    () => ({
      id: receipt.id,
      amount: String(toRupees(receipt.amount)),
      mode: receipt.mode as UpdateReceiptValues["mode"],
      reference: receipt.reference ?? "",
      receivedAt: receipt.receivedAt,
      isAdvance: receipt.isAdvance,
      notes: receipt.notes ?? "",
    }),
    [receipt]
  )

  const { form, onSubmit, isPending } = useCrudForm<UpdateReceiptValues>({
    schema: UpdateReceiptSchema,
    defaultValues: defaultValues as never,
    action: (values) => updateReceipt({ ...values, id: receipt.id } as never),
    successMessage: "Payment updated",
    invalidate: INVALIDATE,
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit payment {receipt.number}</DialogTitle>
        <DialogDescription>
          {balance != null ? (
            <>
              This receipt can be up to{" "}
              <span className="font-medium text-foreground">
                {formatMoney(balance + receipt.amount)}
              </span>{" "}
              — what it covers now plus the balance still due.
            </>
          ) : (
            "Correct the amount, mode, date or advance flag. The receipt number stays the same."
          )}
        </DialogDescription>
      </DialogHeader>

      <ReceiptFields form={form} onSubmit={onSubmit} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="receipt-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Save changes
        </Button>
      </DialogFooter>
    </>
  )
}

/** The fields both forms render — they differ only in bookingId vs id. */
type ReceiptFieldValues = Omit<CreateReceiptValues, "bookingId">

function ReceiptFields({
  form,
  onSubmit,
}: {
  form: { control: unknown }
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>
}) {
  const control = form.control as Control<ReceiptFieldValues>
  return (
    <form id="receipt-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            control={control}
            name="amount"
            label="Amount received (₹)"
            autoFocus
          />
          <SelectField
            control={control}
            name="mode"
            label="Mode"
            options={MODE_OPTIONS}
          />
          <DateField control={control} name="receivedAt" label="Received on" />
          <TextField
            control={control}
            name="reference"
            label="Reference"
            placeholder="UTR / cheque no."
          />
        </div>

        <SwitchField
          control={control}
          name="isAdvance"
          label="This is the advance"
          description="Tracked separately so advance-collected reports stay accurate."
        />

        <TextareaField control={control} name="notes" label="Notes" rows={2} />
      </FieldGroup>
    </form>
  )
}
