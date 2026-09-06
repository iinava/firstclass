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
  TextField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { formatMoney, toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  CreateSupplierPaymentSchema,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  type SupplierPaymentValues,
} from "@/validations/accounts.validation"
import type { TripCostRow } from "@/lib/services/booking.service"
import { createSupplierPayment } from "@/app/admin/accounts-actions"

const MODE_OPTIONS = optionsFrom(PAYMENT_MODES, PAYMENT_MODE_LABELS)

/**
 * Records what was paid to a supplier against one cost line — the other half of
 * ReceiptDialog, which does the same for money coming in from the customer.
 *
 * The payment has to name the cost line, not just the supplier: `paid_amount`
 * lives on the line, and the supplier list's "due" is summed from those lines.
 */
export function SupplierPaymentDialog({
  costItem,
  onOpenChange,
}: {
  costItem: TripCostRow | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={costItem !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {costItem && (
          <SupplierPaymentForm
            costItem={costItem}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SupplierPaymentForm({
  costItem,
  onDone,
  onCancel,
}: {
  costItem: TripCostRow
  onDone: () => void
  onCancel: () => void
}) {
  const outstanding = costItem.costAmount - costItem.paidAmount

  const defaultValues = React.useMemo<SupplierPaymentValues>(
    () => ({
      supplierId: costItem.supplierId ?? "",
      bookingId: costItem.bookingId,
      tripCostItemId: costItem.id,
      // Settling the line in full is the common case, so it is pre-filled.
      amount: String(toRupees(outstanding)),
      mode: "bank_transfer",
      reference: "",
      // Backdatable: bills paid before the system went live are entered here.
      paidAt: new Date().toISOString().slice(0, 10),
      notes: "",
    }),
    [costItem, outstanding]
  )

  const { form, onSubmit, isPending } = useCrudForm<SupplierPaymentValues>({
    schema: CreateSupplierPaymentSchema,
    defaultValues: defaultValues as never,
    action: (values) => createSupplierPayment(values as never),
    successMessage: "Supplier payment recorded",
    invalidate: [qk.bookings.all, qk.accounts.all, qk.suppliers.all, qk.reports.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record supplier payment</DialogTitle>
        <DialogDescription>
          {costItem.supplierName ?? "This supplier"} is owed{" "}
          <span className="font-medium text-foreground">
            {formatMoney(outstanding)}
          </span>{" "}
          on {costItem.description ?? "this cost line"}
          {costItem.paidAmount > 0 &&
            ` (${formatMoney(costItem.paidAmount)} of ${formatMoney(costItem.costAmount)} already paid)`}
          .
        </DialogDescription>
      </DialogHeader>

      <form
        id="supplier-payment-form"
        className="-mx-1 overflow-y-auto px-1"
        onSubmit={onSubmit}
        noValidate
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              control={form.control}
              name="amount"
              label="Amount paid (₹)"
              autoFocus
            />
            <SelectField
              control={form.control}
              name="mode"
              label="Mode"
              options={MODE_OPTIONS}
            />
            <DateField control={form.control} name="paidAt" label="Paid on" />
            <TextField
              control={form.control}
              name="reference"
              label="Reference"
              placeholder="UTR / cheque no."
            />
          </div>

          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="supplier-payment-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Record payment
        </Button>
      </DialogFooter>
    </>
  )
}
