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
  SelectField,
  TextField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  ExpenseFormSchema,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  type ExpenseFormValues,
} from "@/validations/accounts.validation"
import type { ExpenseListRow } from "@/lib/services/accounts.service"
import { fetchBookingOptions } from "@/app/admin/bookings/actions"
import { fetchVehicleOptions } from "@/app/admin/fleet/actions"
import {
  createExpense,
  fetchExpenseCategories,
  updateExpense,
} from "@/app/admin/accounts-actions"

const MODE_OPTIONS = optionsFrom(PAYMENT_MODES, PAYMENT_MODE_LABELS)

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: ExpenseListRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && (
          <ExpenseForm
            key={expense?.id ?? "new"}
            expense={expense ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ExpenseForm({
  expense,
  onDone,
  onCancel,
}: {
  expense: ExpenseListRow | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(expense)

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => unwrapAction(await fetchExpenseCategories()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: bookings } = useQuery({
    queryKey: qk.bookings.list({ options: true }),
    queryFn: async () => unwrapAction(await fetchBookingOptions({ search: undefined })),
    staleTime: 60 * 1000,
  })

  const { data: vehicles } = useQuery({
    queryKey: qk.vehicles.list({ options: true }),
    queryFn: async () => unwrapAction(await fetchVehicleOptions()),
    staleTime: 5 * 60 * 1000,
  })

  const defaultValues = React.useMemo<ExpenseFormValues>(
    () => ({
      bookingId: expense?.bookingId ?? null,
      vehicleId: expense?.vehicleId ?? null,
      categoryId: expense?.categoryId ?? null,
      description: expense?.description ?? "",
      amount: expense ? String(toRupees(expense.amount)) : "",
      spentAt: expense?.spentAt ?? new Date().toISOString().slice(0, 10),
      mode: expense?.mode ?? "cash",
      billUrl: expense?.billUrl ?? "",
      notes: expense?.notes ?? "",
    }),
    [expense]
  )

  const { form, onSubmit, isPending } = useCrudForm<ExpenseFormValues>({
    schema: ExpenseFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      expense
        ? updateExpense({ ...values, id: expense.id } as never)
        : createExpense(values as never),
    successMessage: isEdit ? "Expense updated" : "Expense logged",
    invalidate: [qk.accounts.all, qk.bookings.all, qk.reports.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit expense" : "Log expense"}</DialogTitle>
        <DialogDescription>
          Link it to a trip to include it in that trip&apos;s profit; leave blank for office
          overheads.
        </DialogDescription>
      </DialogHeader>

      <form id="expense-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <TextField
            control={form.control}
            name="description"
            label="What was it for?"
            placeholder="Diesel — Kochi to Munnar"
            autoFocus
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField control={form.control} name="amount" label="Amount (₹)" />
            <DateField control={form.control} name="spentAt" label="Date" />
            <SelectField
              control={form.control}
              name="categoryId"
              label="Category"
              nullable
              placeholder="Uncategorised"
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              control={form.control}
              name="mode"
              label="Paid by"
              options={MODE_OPTIONS}
            />
            <SelectField
              control={form.control}
              name="bookingId"
              label="Trip"
              nullable
              placeholder="Not trip-related"
              options={(bookings ?? []).map((b) => ({
                value: b.id,
                label: `${b.code} — ${b.customerName}`,
              }))}
            />
            <SelectField
              control={form.control}
              name="vehicleId"
              label="Vehicle"
              nullable
              placeholder="Not vehicle-related"
              options={(vehicles ?? []).map((v) => ({
                value: v.id,
                label: v.regNumber,
              }))}
            />
          </div>

          <TextField
            control={form.control}
            name="billUrl"
            label="Bill / receipt link"
            placeholder="Paste a link to the photo (uploads coming later)"
          />
          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="expense-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Log expense"}
        </Button>
      </DialogFooter>
    </>
  )
}
