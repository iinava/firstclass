"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { addDays, format } from "date-fns"
import { useForm, useWatch } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { DownloadIcon } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { DateField, NumberField, TextField } from "@/components/shared/form-fields"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { parseDate } from "@/lib/format"
import { qk } from "@/lib/query-keys"
import {
  PdfGuestSchema,
  pdfGuestQuery,
  type PdfGuest,
  type PdfGuestValues,
} from "@/validations/pdf.validation"
import { fetchPdfGuestDefaults } from "../../actions"

/**
 * "Download PDF" for one customer: the guest box (name, contact, dates, head
 * count) is typed here and printed into the PDF, instead of the printed copy
 * being filled in by hand. Starts from whatever the quote is linked to.
 * Nothing is saved; the values only travel in the download URL.
 */
export function PdfDownloadDialog({
  open,
  onOpenChange,
  itineraryId,
  nights,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itineraryId: string
  nights: number
}) {
  const { data: defaults, isError } = useQuery({
    queryKey: qk.itineraries.pdfGuest(itineraryId),
    queryFn: async () => unwrapAction(await fetchPdfGuestDefaults({ id: itineraryId })),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Download PDF</DialogTitle>
          <DialogDescription>
            Fill in the guest details to print them on the itinerary. Leave a field empty and
            it prints blank.
          </DialogDescription>
        </DialogHeader>

        {open && (defaults || isError) ? (
          <GuestForm
            itineraryId={itineraryId}
            nights={nights}
            defaults={defaults ?? {}}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function GuestForm({
  itineraryId,
  nights,
  defaults,
  onDone,
}: {
  itineraryId: string
  nights: number
  defaults: PdfGuest
  onDone: () => void
}) {
  const form = useForm<PdfGuestValues>({
    resolver: standardSchemaResolver(PdfGuestSchema) as never,
    defaultValues: {
      name: defaults.name ?? "",
      phone: defaults.phone ?? "",
      arrival: defaults.arrival ?? "",
      departure:
        defaults.departure ?? (defaults.arrival ? shiftDate(defaults.arrival, nights) : ""),
      adults: defaults.adults ?? "",
      children: defaults.children || "",
    } as never,
  })

  // Picking an arrival moves the departure along with it; it stays editable
  // for trips that don't match the package length.
  const arrival = useWatch({ control: form.control, name: "arrival" })
  const lastArrival = React.useRef(arrival)
  React.useEffect(() => {
    if (arrival === lastArrival.current) return
    lastArrival.current = arrival
    if (arrival) form.setValue("departure", shiftDate(arrival, nights), { shouldValidate: true })
  }, [arrival, nights, form])

  const download = (query: string) => {
    window.location.assign(`/admin/packages/${itineraryId}/pdf/download${query ? `?${query}` : ""}`)
    onDone()
  }

  const onSubmit = form.handleSubmit((values) => download(pdfGuestQuery(values)))

  return (
    <>
      <form id="pdf-guest-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Guest name" autoFocus />
            <TextField control={form.control} name="phone" label="Contact number" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField control={form.control} name="arrival" label="Arrival date" />
            <DateField control={form.control} name="departure" label="Departure date" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField control={form.control} name="adults" label="Adults" min={0} />
            <NumberField control={form.control} name="children" label="Children" min={0} />
          </div>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => download("blank=1")}>
          Download blank
        </Button>
        <Button type="submit" form="pdf-guest-form">
          <DownloadIcon data-icon="inline-start" />
          Download PDF
        </Button>
      </DialogFooter>
    </>
  )
}

function shiftDate(value: string, days: number): string {
  const date = parseDate(value)
  return date ? format(addDays(date, days), "yyyy-MM-dd") : ""
}
