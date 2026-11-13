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
import { EmployeeSelectField } from "@/components/shared/pickers"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
} from "@/validations/accounts.validation"
import {
  CreateSalaryAdvanceSchema,
  type SalaryAdvanceFormValues,
} from "@/validations/payroll.validation"
import { createSalaryAdvance } from "@/app/admin/payroll/actions"

const MODE_OPTIONS = optionsFrom(PAYMENT_MODES, PAYMENT_MODE_LABELS)

export function SalaryAdvanceDialog({
  open,
  onOpenChange,
  month,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** YYYY-MM — the month on screen, used as the default recovery month. */
  month: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <SalaryAdvanceForm
            month={month}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SalaryAdvanceForm({
  month,
  onDone,
  onCancel,
}: {
  month: string
  onDone: () => void
  onCancel: () => void
}) {
  const defaultValues = React.useMemo<SalaryAdvanceFormValues>(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      employeeId: "",
      month,
      amount: "",
      // Default the date into the month on screen when looking at another month.
      givenOn: today.startsWith(month) ? today : `${month}-01`,
      mode: "cash",
      notes: "",
    }
  }, [month])

  const { form, onSubmit, isPending } = useCrudForm<SalaryAdvanceFormValues>({
    schema: CreateSalaryAdvanceSchema,
    defaultValues: defaultValues as never,
    action: (values) => createSalaryAdvance(values as never),
    successMessage: "Advance recorded",
    invalidate: [qk.payroll.all, qk.accounts.all, qk.reports.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record salary advance</DialogTitle>
        <DialogDescription>
          Money an employee took ahead of payday. It is logged as a Salaries expense
          today and taken off their pay for the month you pick.
        </DialogDescription>
      </DialogHeader>

      <form
        id="salary-advance-form"
        className="-mx-1 overflow-y-auto px-1"
        onSubmit={onSubmit}
        noValidate
      >
        <FieldGroup>
          <EmployeeSelectField control={form.control} name="employeeId" />

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField control={form.control} name="amount" label="Amount (₹)" />
            <DateField control={form.control} name="givenOn" label="Given on" />
            <TextField
              control={form.control}
              name="month"
              label="Deduct from salary of"
              type="month"
            />
            <SelectField
              control={form.control}
              name="mode"
              label="Paid by"
              options={MODE_OPTIONS}
            />
          </div>

          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="salary-advance-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Record advance
        </Button>
      </DialogFooter>
    </>
  )
}
