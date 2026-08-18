"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  CustomerFormSchema,
  LEAD_SOURCES,
  SOURCE_LABELS,
  type CustomerFormValues,
} from "@/validations/customer.validation"
import { createCustomer, updateCustomer } from "../actions"
import type { CustomerListRow } from "@/lib/services/customer.service"

interface CustomerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit mode, absent = create mode. */
  customer?: CustomerListRow | null
}

const SOURCE_OPTIONS = optionsFrom(LEAD_SOURCES, SOURCE_LABELS)

const EMPTY: CustomerFormValues = {
  name: "",
  phone: "",
  altPhone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  source: "walk_in",
  gstin: "",
  notes: "",
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: CustomerFormDialogProps) {
  const isEdit = Boolean(customer)

  const defaultValues = React.useMemo<CustomerFormValues>(
    () =>
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            altPhone: customer.altPhone ?? "",
            email: customer.email ?? "",
            address: customer.address ?? "",
            city: customer.city ?? "",
            state: customer.state ?? "",
            pincode: customer.pincode ?? "",
            source: customer.source,
            gstin: customer.gstin ?? "",
            notes: customer.notes ?? "",
          }
        : EMPTY,
    [customer]
  )

  const { form, onSubmit, isPending } = useCrudForm<CustomerFormValues>({
    schema: CustomerFormSchema,
    defaultValues: defaultValues as never,
    // `id` is context, not user input, so it is closed over here rather than
    // living as a hidden field the client could tamper with.
    action: (values) =>
      customer
        ? updateCustomer({ ...values, id: customer.id } as never)
        : createCustomer(values as never),
    successMessage: isEdit ? "Customer updated" : "Customer added",
    invalidate: [qk.customers.all],
    onSuccess: () => onOpenChange(false),
  })

  // Re-seed the form whenever a different customer is opened for editing.
  React.useEffect(() => {
    if (open) form.reset(defaultValues as never)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id])

  const errors = form.formState.errors as Record<string, { message?: string }>

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the contact details on file."
              : "Phone number is the unique key — a repeat caller will match an existing record."}
          </DialogDescription>
        </DialogHeader>

        <form id="customer-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="customer-name">Full name</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="customer-name"
                      autoFocus
                      placeholder="Ramesh Kumar"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="customer-phone">Phone</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="customer-phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="altPhone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="customer-alt-phone">
                      Alternate phone
                    </FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="customer-alt-phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="Optional"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="customer-email">Email</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="customer-email"
                      type="email"
                      placeholder="Optional"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="city"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="customer-city">City</FieldLabel>
                    <Input
                      {...field}
                      value={(field.value as string) ?? ""}
                      id="customer-city"
                      placeholder="Kochi"
                    />
                  </Field>
                )}
              />

              <Controller
                name="source"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="customer-source">
                      How did they find you?
                    </FieldLabel>
                    <OptionSelect
                      id="customer-source"
                      className="w-full"
                      options={SOURCE_OPTIONS}
                      value={(field.value as string) ?? "walk_in"}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </Field>
                )}
              />
            </div>

            <Controller
              name="address"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="customer-address">Address</FieldLabel>
                  <Textarea
                    {...field}
                    value={(field.value as string) ?? ""}
                    id="customer-address"
                    rows={2}
                    placeholder="Optional"
                  />
                </Field>
              )}
            />

            <Controller
              name="notes"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="customer-notes">Notes</FieldLabel>
                  <Textarea
                    {...field}
                    value={(field.value as string) ?? ""}
                    id="customer-notes"
                    rows={2}
                    placeholder="Preferences, past complaints, anything worth remembering"
                  />
                </Field>
              )}
            />

            {errors.root?.message && (
              <p className="text-destructive text-sm">{errors.root.message}</p>
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
          <Button type="submit" form="customer-form" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            {isEdit ? "Save changes" : "Add customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
