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
} from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  EmployeeFormSchema,
  type EmployeeFormValues,
} from "@/validations/hrms.validation"
import type { EmployeeListRow } from "@/lib/services/hrms.service"
import { createEmployee, fetchLinkableUsers, updateEmployee } from "../actions"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
]

const EMPTY: EmployeeFormValues = {
  name: "",
  phone: "",
  email: "",
  designation: "",
  department: "",
  dateOfJoining: "",
  dateOfBirth: "",
  address: "",
  monthlySalary: "",
  emergencyContact: "",
  userId: null,
  status: "active",
  notes: "",
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: EmployeeListRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <EmployeeForm
            key={employee?.id ?? "new"}
            employee={employee ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EmployeeForm({
  employee,
  onDone,
  onCancel,
}: {
  employee: EmployeeListRow | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(employee)

  const { data: users } = useQuery({
    queryKey: qk.users.options(),
    queryFn: async () => unwrapAction(await fetchLinkableUsers()),
    staleTime: 5 * 60 * 1000,
  })

  const defaultValues = React.useMemo<EmployeeFormValues>(
    () =>
      employee
        ? {
            name: employee.name,
            phone: employee.phone,
            email: employee.email ?? "",
            designation: employee.designation ?? "",
            department: employee.department ?? "",
            dateOfJoining: employee.dateOfJoining ?? "",
            dateOfBirth: employee.dateOfBirth ?? "",
            address: employee.address ?? "",
            monthlySalary: employee.monthlySalary
              ? String(toRupees(employee.monthlySalary))
              : "",
            emergencyContact: employee.emergencyContact ?? "",
            userId: employee.userId,
            status: employee.status,
            notes: employee.notes ?? "",
          }
        : EMPTY,
    [employee]
  )

  const { form, onSubmit, isPending } = useCrudForm<EmployeeFormValues>({
    schema: EmployeeFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      employee
        ? updateEmployee({ ...values, id: employee.id } as never)
        : createEmployee(values as never),
    successMessage: isEdit ? "Employee updated" : "Employee added",
    invalidate: [qk.hrms.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit employee" : "Add employee"}</DialogTitle>
        <DialogDescription>
          Link a login account if this person needs access to the admin panel.
        </DialogDescription>
      </DialogHeader>

      <form id="employee-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Name" autoFocus />
            <TextField
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
            />
            <TextField control={form.control} name="email" label="Email" type="email" />
            <TextField
              control={form.control}
              name="designation"
              label="Designation"
              placeholder="Travel consultant"
            />
            <TextField
              control={form.control}
              name="department"
              label="Department"
              placeholder="Sales"
            />
            <SelectField
              control={form.control}
              name="status"
              label="Status"
              options={STATUS_OPTIONS}
            />
            <DateField
              control={form.control}
              name="dateOfJoining"
              label="Date of joining"
            />
            <DateField control={form.control} name="dateOfBirth" label="Date of birth" />
            <MoneyField
              control={form.control}
              name="monthlySalary"
              label="Monthly salary (₹)"
            />
            <TextField
              control={form.control}
              name="emergencyContact"
              label="Emergency contact"
            />
            <SelectField
              control={form.control}
              name="userId"
              label="Login account"
              nullable
              placeholder="No login access"
              options={(users ?? []).map((u) => ({
                value: u.id,
                label: `${u.name} (${u.role})`,
              }))}
              className="sm:col-span-2"
            />
          </div>

          <TextareaField control={form.control} name="address" label="Address" rows={2} />
          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="employee-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Add employee"}
        </Button>
      </DialogFooter>
    </>
  )
}
