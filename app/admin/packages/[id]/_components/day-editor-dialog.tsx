"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { NumberField, TextField, TextareaField } from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  ItineraryDaySchema,
  type ItineraryDayValues,
} from "@/validations/itinerary.validation"
import type { ItineraryDay } from "@/db/schemas/itinerary.schema"
import { saveDay, updateDay } from "../../actions"

export function DayEditorDialog({
  open,
  onOpenChange,
  itineraryId,
  day,
  nextDayNumber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itineraryId: string
  day?: ItineraryDay | null
  nextDayNumber: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        {open && (
          <DayForm
            key={day?.id ?? `new-${nextDayNumber}`}
            itineraryId={itineraryId}
            day={day ?? null}
            nextDayNumber={nextDayNumber}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DayForm({
  itineraryId,
  day,
  nextDayNumber,
  onDone,
  onCancel,
}: {
  itineraryId: string
  day: ItineraryDay | null
  nextDayNumber: number
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(day)

  const defaultValues = React.useMemo<ItineraryDayValues>(
    () => ({
      itineraryId,
      dayNumber: day?.dayNumber ?? nextDayNumber,
      title: day?.title ?? "",
      description: day?.description ?? "",
      stayNote: day?.stayNote ?? "",
      breakfast: day?.breakfast ?? false,
      lunch: day?.lunch ?? false,
      dinner: day?.dinner ?? false,
    }),
    [itineraryId, day, nextDayNumber]
  )

  const { form, onSubmit, isPending } = useCrudForm<ItineraryDayValues>({
    schema: ItineraryDaySchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      day
        ? updateDay({ ...values, id: day.id } as never)
        : saveDay({ ...values, itineraryId } as never),
    successMessage: isEdit ? "Day updated" : "Day added",
    invalidate: [qk.itineraries.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? `Edit day ${day?.dayNumber}` : "Add day"}</DialogTitle>
        <DialogDescription>
          This is what the customer reads on the shared page.
        </DialogDescription>
      </DialogHeader>

      <form id="day-form" className="-mx-1 overflow-y-auto px-1" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <NumberField
              control={form.control}
              name="dayNumber"
              label="Day"
              min={1}
              disabled={isEdit}
            />
            <TextField
              control={form.control}
              name="title"
              label="Title"
              placeholder="Arrival in Kochi & drive to Munnar"
              autoFocus
            />
          </div>

          <TextareaField
            control={form.control}
            name="description"
            label="What happens"
            rows={5}
            placeholder="Pick up from Kochi airport, drive through the tea plantations, stop at Cheeyappara waterfalls…"
          />

          <TextField
            control={form.control}
            name="stayNote"
            label="Overnight stay"
            placeholder="Tea Valley Resort, Munnar"
          />

          <FieldSet>
            <FieldLabel>Meals included</FieldLabel>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["breakfast", "Breakfast"],
                  ["lunch", "Lunch"],
                  ["dinner", "Dinner"],
                ] as const
              ).map(([name, label]) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="w-auto">
                      <Checkbox
                        id={`meal-${name}`}
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                      />
                      <FieldLabel htmlFor={`meal-${name}`} className="font-normal">
                        {label}
                      </FieldLabel>
                    </Field>
                  )}
                />
              ))}
            </div>
          </FieldSet>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="day-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save day" : "Add day"}
        </Button>
      </DialogFooter>
    </>
  )
}
