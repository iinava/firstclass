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
  SelectField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  LeaveRequestSchema,
  type LeaveRequestValues,
} from "@/validations/hrms.validation"
import { fetchEmployeeOptions, requestLeave } from "@/app/admin/employees/actions"

const TYPE_OPTIONS = optionsFrom(LEAVE_TYPES, LEAVE_TYPE_LABELS)

export function RecordLeaveDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <RecordLeaveForm
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RecordLeaveForm({
  onDone,
  onCancel,
}: {
  onDone: () => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: employees } = useQuery({
    queryKey: qk.hrms.employees({ options: true }),
    queryFn: async () =>
      unwrapAction(await fetchEmployeeOptions({ search: undefined })),
    staleTime: 5 * 60 * 1000,
  })

  const defaultValues = React.useMemo<LeaveRequestValues>(
    () => ({
      employeeId: "",
      type: "casual",
      fromDate: today,
      toDate: today,
      reason: "",
    }),
    [today]
  )

  const { form, onSubmit, isPending } = useCrudForm<LeaveRequestValues>({
    schema: LeaveRequestSchema,
    defaultValues: defaultValues as never,
    action: (values) => requestLeave(values as never),
    successMessage: "Leave recorded",
    invalidate: [qk.hrms.all],
    onSuccess: onDone,
  })

  // A single-day leave is the common case, so keep the end date following the
  // start until it is set explicitly.
  const fromDate = form.watch("fromDate")
  React.useEffect(() => {
    const toDate = form.getValues("toDate")
    if (fromDate && (!toDate || toDate < fromDate)) {
      form.setValue("toDate", fromDate, { shouldValidate: false })
    }
  }, [fromDate, form])

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record leave</DialogTitle>
        <DialogDescription>
          Enter what the employee asked for. It is saved as pending until an
          administrator approves or rejects it.
        </DialogDescription>
      </DialogHeader>

      <form id="record-leave-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <SelectField
            control={form.control}
            name="employeeId"
            label="Employee"
            placeholder="Choose an employee"
            options={(employees ?? []).map((e) => ({
              value: e.id,
              label: `${e.name} — ${e.empCode}`,
            }))}
          />

          <SelectField
            control={form.control}
            name="type"
            label="Type of leave"
            options={TYPE_OPTIONS}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <DateField control={form.control} name="fromDate" label="From" />
            <DateField control={form.control} name="toDate" label="To" />
          </div>

          <TextareaField
            control={form.control}
            name="reason"
            label="Reason"
            rows={3}
            placeholder="Family function in Thrissur"
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="record-leave-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Record leave
        </Button>
      </DialogFooter>
    </>
  )
}
