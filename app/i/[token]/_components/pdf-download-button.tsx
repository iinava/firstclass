"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { DownloadIcon, XIcon } from "lucide-react"
import { parseDate } from "@/lib/format"
import { PdfGuestSchema, pdfGuestQuery, type PdfGuestValues } from "@/validations/pdf.validation"

/**
 * A share-page "Download PDF" button that first asks who the itinerary is
 * for, so the guest box on the PDF comes out filled. Everything is optional
 * and nothing is stored; the values only ride along in the download URL.
 *
 * A native <dialog> styled in the page's fixed light palette, rather than the
 * admin Dialog, which would follow the admin app's dark theme.
 */
export function PdfDownloadButton({
  href,
  nights,
  className,
  children,
}: {
  href: string
  nights: number
  className?: string
  children: React.ReactNode
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)

  const set = (key: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value }
      // Picking an arrival moves the departure along with it; still editable.
      if (key === "arrival") {
        const date = parseDate(value)
        next.departure = date ? format(addDays(date, nights), "yyyy-MM-dd") : ""
      }
      return next
    })
    setError(null)
  }

  const download = (query: string) => {
    window.location.assign(query ? `${href}?${query}` : href)
    dialogRef.current?.close()
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = PdfGuestSchema.safeParse(values as PdfGuestValues)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the details")
      return
    }
    download(pdfGuestQuery(parsed.data))
  }

  const input =
    "h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm text-[#1a2340] outline-none focus:border-[#1e2b5e] focus:ring-2 focus:ring-[#1e2b5e]/15"
  const label = "flex flex-col gap-1.5 text-xs font-medium tracking-wide text-[#1a2340]/70"

  return (
    <>
      <button type="button" className={className} onClick={() => dialogRef.current?.showModal()}>
        {children}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-[#1a2340] shadow-2xl backdrop:bg-black/50"
        onClick={(event) => {
          // A click on the backdrop lands on the <dialog> itself.
          if (event.target === dialogRef.current) dialogRef.current.close()
        }}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6" noValidate>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Download your itinerary</h2>
              <p className="mt-1 text-sm text-[#1a2340]/60">
                Add your details to print them on the PDF. Everything is optional.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="rounded-full p-1 text-[#1a2340]/50 hover:bg-black/5"
              onClick={() => dialogRef.current?.close()}
            >
              <XIcon className="size-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Guest name
              <input className={input} value={values.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label className={label}>
              Contact number
              <input
                className={input}
                type="tel"
                value={values.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </label>
            <label className={label}>
              Arrival date
              <input
                className={input}
                type="date"
                value={values.arrival ?? ""}
                onChange={(e) => set("arrival", e.target.value)}
              />
            </label>
            <label className={label}>
              Departure date
              <input
                className={input}
                type="date"
                min={values.arrival || undefined}
                value={values.departure ?? ""}
                onChange={(e) => set("departure", e.target.value)}
              />
            </label>
            <label className={label}>
              Adults
              <input
                className={input}
                type="number"
                min={0}
                max={99}
                value={values.adults ?? ""}
                onChange={(e) => set("adults", e.target.value)}
              />
            </label>
            <label className={label}>
              Children
              <input
                className={input}
                type="number"
                min={0}
                max={99}
                value={values.children ?? ""}
                onChange={(e) => set("children", e.target.value)}
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="h-10 rounded-full border border-black/10 px-4 text-sm font-medium hover:bg-black/[0.03]"
              onClick={() => download("")}
            >
              Skip, download blank
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1e2b5e] px-5 text-sm font-medium text-white hover:opacity-90"
            >
              <DownloadIcon className="size-4" />
              Download PDF
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
