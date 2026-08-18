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
  NumberField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
  optionsFrom,
} from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  SupplierFormSchema,
  type SupplierFormValues,
} from "@/validations/supplier.validation"
import type { SupplierListRow } from "@/lib/services/supplier.service"
import { createSupplier, updateSupplier } from "../actions"

const TYPE_OPTIONS = optionsFrom(SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS)

const EMPTY: SupplierFormValues = {
  name: "",
  type: "hotel",
  contactPerson: "",
  phone: "",
  altPhone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  gstin: "",
  paymentTerms: "",
  bankDetails: "",
  rating: null,
  notes: "",
  isActive: true,
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: SupplierListRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <SupplierForm
            key={supplier?.id ?? "new"}
            supplier={supplier ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SupplierForm({
  supplier,
  onDone,
  onCancel,
}: {
  supplier: SupplierListRow | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(supplier)

  const defaultValues = React.useMemo<SupplierFormValues>(
    () =>
      supplier
        ? {
            name: supplier.name,
            type: supplier.type,
            contactPerson: supplier.contactPerson ?? "",
            phone: supplier.phone ?? "",
            altPhone: supplier.altPhone ?? "",
            email: supplier.email ?? "",
            address: supplier.address ?? "",
            city: supplier.city ?? "",
            state: supplier.state ?? "",
            gstin: supplier.gstin ?? "",
            paymentTerms: supplier.paymentTerms ?? "",
            bankDetails: supplier.bankDetails ?? "",
            rating: supplier.rating,
            notes: supplier.notes ?? "",
            isActive: supplier.isActive,
          }
        : EMPTY,
    [supplier]
  )

  const { form, onSubmit, isPending } = useCrudForm<SupplierFormValues>({
    schema: SupplierFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      supplier
        ? updateSupplier({ ...values, id: supplier.id } as never)
        : createSupplier(values as never),
    successMessage: isEdit ? "Supplier updated" : "Supplier added",
    invalidate: [qk.suppliers.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit supplier" : "Add supplier"}</DialogTitle>
        <DialogDescription>
          Rates and contract terms recorded here pre-fill trip cost lines.
        </DialogDescription>
      </DialogHeader>

      <form id="supplier-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="name"
              label="Supplier name"
              placeholder="Tea Valley Resort"
              autoFocus
            />
            <SelectField
              control={form.control}
              name="type"
              label="Type"
              options={TYPE_OPTIONS}
            />
            <TextField
              control={form.control}
              name="contactPerson"
              label="Contact person"
              placeholder="Optional"
            />
            <TextField
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
            />
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              placeholder="Optional"
            />
            <TextField control={form.control} name="city" label="City" />
            <TextField
              control={form.control}
              name="gstin"
              label="GSTIN"
              placeholder="Optional"
            />
            <NumberField
              control={form.control}
              name="rating"
              label="Rating (1–5)"
              min={1}
              max={5}
              placeholder="Optional"
            />
          </div>

          <TextareaField
            control={form.control}
            name="address"
            label="Address"
            rows={2}
          />
          <TextField
            control={form.control}
            name="paymentTerms"
            label="Payment terms"
            placeholder="50% advance, balance on checkout"
          />
          <TextareaField
            control={form.control}
            name="bankDetails"
            label="Bank details"
            rows={2}
            placeholder="Account number, IFSC, UPI ID"
          />
          <TextareaField control={form.control} name="notes" label="Notes" rows={2} />

          <SwitchField
            control={form.control}
            name="isActive"
            label="Active"
            description="Inactive suppliers stay in reports but are hidden from pickers."
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="supplier-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Add supplier"}
        </Button>
      </DialogFooter>
    </>
  )
}
