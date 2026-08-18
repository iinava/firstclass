"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import { toRupees } from "@/lib/money"
import { LEAD_SOURCES, SOURCE_LABELS } from "@/validations/customer.validation"
import {
  CreateLeadSchema,
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type CreateLeadValues,
} from "@/validations/lead.validation"
import type { LeadListRow } from "@/lib/services/lead.service"
import { createLead, fetchAssignableUsers, updateLead } from "../actions"

interface LeadFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: LeadListRow | null
}

const SOURCE_OPTIONS = optionsFrom(LEAD_SOURCES, SOURCE_LABELS)

const PRIORITY_OPTIONS = LEAD_PRIORITIES.map((priority) => ({
  value: priority,
  label: priority[0].toUpperCase() + priority.slice(1),
}))

// Won/lost are reached by working the enquiry, not by opening it there.
const STATUS_OPTIONS = optionsFrom(
  LEAD_STATUSES.filter((status) => status !== "won" && status !== "lost"),
  LEAD_STATUS_LABELS
)

const EMPTY: CreateLeadValues = {
  customerName: "",
  customerPhone: "",
  destination: "",
  travelDate: "",
  durationDays: undefined,
  adults: 1,
  children: 0,
  budget: "",
  status: "new",
  priority: "medium",
  source: "phone",
  assignedTo: null,
  requirements: "",
  followupAt: "",
  followupNote: "",
}

export function LeadFormDialog({ open, onOpenChange, lead }: LeadFormDialogProps) {
  const isEdit = Boolean(lead)

  const { data: assignees } = useQuery({
    queryKey: qk.users.options(),
    queryFn: async () => unwrapAction(await fetchAssignableUsers()),
    staleTime: 5 * 60 * 1000,
  })

  const assigneeOptions = React.useMemo(
    () => [
      { value: "", label: "Me" },
      ...(assignees ?? []).map((user) => ({ value: user.id, label: user.name })),
    ],
    [assignees]
  )

  const defaultValues = React.useMemo<CreateLeadValues>(
    () =>
      lead
        ? {
            ...EMPTY,
            customerName: lead.customerName,
            customerPhone: lead.customerPhone,
            destination: lead.destination ?? "",
            travelDate: lead.travelDate ?? "",
            adults: lead.adults,
            children: lead.children,
            budget: lead.budget ? String(toRupees(lead.budget)) : "",
            priority: lead.priority,
            source: lead.source,
            assignedTo: lead.assignedTo,
            requirements: lead.requirements ?? "",
          }
        : EMPTY,
    [lead]
  )

  const { form, onSubmit, isPending } = useCrudForm<CreateLeadValues>({
    // Always the create schema: it matches the rendered fields exactly. The edit
    // action re-validates with UpdateLeadSchema on the server, which ignores the
    // customer identity fields — those are read-only once a lead exists.
    schema: CreateLeadSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      lead
        ? updateLead({ ...values, id: lead.id } as never)
        : createLead(values as never),
    successMessage: isEdit ? "Lead updated" : "Enquiry logged",
    invalidate: [qk.leads.all, qk.followups.all, qk.customers.all],
    onSuccess: () => onOpenChange(false),
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues as never)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id])

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit enquiry" : "New enquiry"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the trip requirements for this enquiry."
              : "The customer is matched on phone number — an existing caller reuses their record automatically."}
          </DialogDescription>
        </DialogHeader>

        <form id="lead-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="customerName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} data-disabled={isEdit}>
                    <FieldLabel htmlFor="lead-customer-name">Customer name</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="lead-customer-name"
                      autoFocus={!isEdit}
                      disabled={isEdit}
                      placeholder="Ramesh Kumar"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="customerPhone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} data-disabled={isEdit}>
                    <FieldLabel htmlFor="lead-customer-phone">Phone</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="lead-customer-phone"
                      type="tel"
                      inputMode="numeric"
                      disabled={isEdit}
                      placeholder="98765 43210"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="destination"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="lead-destination">Destination</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="lead-destination"
                      placeholder="Munnar, Alleppey"
                    />
                  </Field>
                )}
              />

              <Controller
                name="travelDate"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="lead-travel-date">
                      Approx. travel date
                    </FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="lead-travel-date"
                      type="date"
                    />
                  </Field>
                )}
              />

              <div className="grid grid-cols-3 gap-2">
                <Controller
                  name="adults"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="lead-adults">Adults</FieldLabel>
                      <Input
                        {...field}
                        value={String(field.value ?? 1)}
                        id="lead-adults"
                        type="number"
                        min={1}
                        aria-invalid={fieldState.invalid}
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="children"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="lead-children">Children</FieldLabel>
                      <Input
                        {...field}
                        value={String(field.value ?? 0)}
                        id="lead-children"
                        type="number"
                        min={0}
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="durationDays"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="lead-duration">Days</FieldLabel>
                      <Input
                        {...field}
                        value={field.value == null ? "" : String(field.value)}
                        id="lead-duration"
                        type="number"
                        min={0}
                      />
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="budget"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="lead-budget">Budget (₹)</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="lead-budget"
                      inputMode="decimal"
                      placeholder="45000"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="source"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="lead-source">Source</FieldLabel>
                    <OptionSelect
                      id="lead-source"
                      className="w-full"
                      name={field.name}
                      options={SOURCE_OPTIONS}
                      value={(field.value as string) ?? "phone"}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </Field>
                )}
              />

              <Controller
                name="priority"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="lead-priority">Priority</FieldLabel>
                    <OptionSelect
                      id="lead-priority"
                      className="w-full"
                      name={field.name}
                      options={PRIORITY_OPTIONS}
                      value={(field.value as string) ?? "medium"}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </Field>
                )}
              />

              <Controller
                name="assignedTo"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="lead-assigned">Assign to</FieldLabel>
                    <OptionSelect
                      id="lead-assigned"
                      className="w-full"
                      name={field.name}
                      options={assigneeOptions}
                      value={(field.value as string) ?? ""}
                      onValueChange={(value) => field.onChange(value || null)}
                      onBlur={field.onBlur}
                    />
                  </Field>
                )}
              />

              {!isEdit && (
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="lead-status">Stage</FieldLabel>
                      <OptionSelect
                        id="lead-status"
                        className="w-full"
                        name={field.name}
                        options={STATUS_OPTIONS}
                        value={(field.value as string) ?? "new"}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </Field>
                  )}
                />
              )}
            </div>

            <Controller
              name="requirements"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="lead-requirements">Requirements</FieldLabel>
                  <Textarea
                    {...field}
                    value={(field.value as string) ?? ""}
                    id="lead-requirements"
                    rows={3}
                    placeholder="Hotel preference, dietary needs, must-see places, anything the customer mentioned"
                  />
                </Field>
              )}
            />

            {!isEdit && (
              <div className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-2">
                <Controller
                  name="followupAt"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="lead-followup-at">
                        Schedule first follow-up
                      </FieldLabel>
                      <Input
                        {...field}
                        value={(field.value as string) ?? ""}
                        id="lead-followup-at"
                        type="datetime-local"
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="followupNote"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="lead-followup-note">
                        Follow-up note
                      </FieldLabel>
                      <Input
                        {...field}
                        value={(field.value as string) ?? ""}
                        id="lead-followup-note"
                        placeholder="Send Munnar itinerary"
                      />
                    </Field>
                  )}
                />
              </div>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="lead-form" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            {isEdit ? "Save changes" : "Log enquiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
