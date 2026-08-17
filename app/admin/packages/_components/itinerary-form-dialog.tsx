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
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { toRupees } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  ItineraryFormSchema,
  type ItineraryFormValues,
} from "@/validations/itinerary.validation"
import type { ItineraryListRow } from "@/lib/services/itinerary.service"
import { createItinerary, updateItinerary } from "../actions"

const EMPTY: ItineraryFormValues = {
  kind: "package",
  title: "",
  destination: "",
  durationDays: 3,
  durationNights: 2,
  summary: "",
  coverImageUrl: "",
  leadId: null,
  customerId: null,
  pricingMode: "per_pax",
  pricePerAdult: "",
  pricePerChild: "",
  fixedPrice: "",
  inclusions: [],
  exclusions: [],
  termsAndConditions: "",
  validUntil: "",
}

export function ItineraryFormDialog({
  open,
  onOpenChange,
  itinerary,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itinerary?: ItineraryListRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && (
          <ItineraryForm
            key={itinerary?.id ?? "new"}
            itinerary={itinerary ?? null}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ItineraryForm({
  itinerary,
  onDone,
  onCancel,
}: {
  itinerary: ItineraryListRow | null
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(itinerary)

  const defaultValues = React.useMemo<ItineraryFormValues>(
    () =>
      itinerary
        ? {
            kind: itinerary.kind,
            title: itinerary.title,
            destination: itinerary.destination ?? "",
            durationDays: itinerary.durationDays,
            durationNights: itinerary.durationNights,
            summary: itinerary.summary ?? "",
            coverImageUrl: itinerary.coverImageUrl ?? "",
            leadId: itinerary.leadId,
            customerId: itinerary.customerId,
            pricingMode: itinerary.pricingMode,
            pricePerAdult: itinerary.pricePerAdult
              ? String(toRupees(itinerary.pricePerAdult))
              : "",
            pricePerChild: itinerary.pricePerChild
              ? String(toRupees(itinerary.pricePerChild))
              : "",
            fixedPrice: itinerary.fixedPrice ? String(toRupees(itinerary.fixedPrice)) : "",
            inclusions: itinerary.inclusions ?? [],
            exclusions: itinerary.exclusions ?? [],
            termsAndConditions: itinerary.termsAndConditions ?? "",
            validUntil: itinerary.validUntil ?? "",
          }
        : EMPTY,
    [itinerary]
  )

  const { form, onSubmit, isPending } = useCrudForm<ItineraryFormValues>({
    schema: ItineraryFormSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      itinerary
        ? updateItinerary({ ...values, id: itinerary.id } as never)
        : createItinerary(values as never),
    successMessage: isEdit ? "Itinerary updated" : "Itinerary created",
    invalidate: [qk.itineraries.all],
    onSuccess: onDone,
  })

  const pricingMode = form.watch("pricingMode")

  // Inclusions/exclusions are stored as arrays but edited as one-per-line text.
  const linesToArray = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit itinerary" : "New itinerary"}</DialogTitle>
        <DialogDescription>
          Day-by-day details and photos are added on the next screen.
        </DialogDescription>
      </DialogHeader>

      <form id="itinerary-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="kind"
              label="Type"
              disabled={isEdit}
              options={[
                { value: "package", label: "Package (reusable)" },
                { value: "custom", label: "Custom quote" },
              ]}
            />
            <TextField
              control={form.control}
              name="destination"
              label="Destination"
              placeholder="Munnar, Thekkady"
            />
            <TextField
              control={form.control}
              name="title"
              label="Title"
              placeholder="Munnar & Thekkady Getaway"
              className="sm:col-span-2"
              autoFocus
            />
            <NumberField
              control={form.control}
              name="durationDays"
              label="Days"
              min={1}
            />
            <NumberField
              control={form.control}
              name="durationNights"
              label="Nights"
              min={0}
            />
          </div>

          <TextareaField
            control={form.control}
            name="summary"
            label="Summary"
            rows={3}
            placeholder="A short pitch shown at the top of the shared page"
          />

          <TextField
            control={form.control}
            name="coverImageUrl"
            label="Cover image URL"
            placeholder="https://…"
          />

          <div className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="pricingMode"
              label="Pricing"
              options={[
                { value: "per_pax", label: "Per person" },
                { value: "fixed", label: "Fixed price" },
              ]}
            />
            {pricingMode === "per_pax" ? (
              <>
                <MoneyField
                  control={form.control}
                  name="pricePerAdult"
                  label="Per adult (₹)"
                />
                <MoneyField
                  control={form.control}
                  name="pricePerChild"
                  label="Per child (₹)"
                />
              </>
            ) : (
              <MoneyField
                control={form.control}
                name="fixedPrice"
                label="Total price (₹)"
              />
            )}
            <DateField control={form.control} name="validUntil" label="Valid until" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="inclusions"
                className="mb-1.5 block text-sm font-medium"
              >
                Inclusions
              </label>
              <textarea
                id="inclusions"
                rows={5}
                className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
                placeholder={"One per line\nAll transfers by private vehicle\nDaily breakfast"}
                defaultValue={(defaultValues.inclusions ?? []).join("\n")}
                onChange={(event) =>
                  form.setValue("inclusions", linesToArray(event.target.value) as never)
                }
              />
            </div>
            <div>
              <label
                htmlFor="exclusions"
                className="mb-1.5 block text-sm font-medium"
              >
                Exclusions
              </label>
              <textarea
                id="exclusions"
                rows={5}
                className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
                placeholder={"One per line\nAirfare\nPersonal expenses"}
                defaultValue={(defaultValues.exclusions ?? []).join("\n")}
                onChange={(event) =>
                  form.setValue("exclusions", linesToArray(event.target.value) as never)
                }
              />
            </div>
          </div>

          <TextareaField
            control={form.control}
            name="termsAndConditions"
            label="Terms & conditions"
            rows={3}
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="itinerary-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Create"}
        </Button>
      </DialogFooter>
    </>
  )
}
