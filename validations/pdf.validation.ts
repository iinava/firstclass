import { z } from "zod"
import { optionalDateString, optionalText } from "./common.validation"

/** "" and missing both mean "not given"; anything else must be a small whole number. */
const optionalCount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z
    .number("Enter a number")
    .int("Enter a whole number")
    .min(0, "Cannot be negative")
    .max(99, "Too many")
    .nullable()
)

/**
 * The guest box printed on an itinerary PDF. Staff fill it in the download
 * dialog; it travels to the download route as query parameters, so the same
 * schema validates the form and parses the URL. Nothing here is stored.
 */
export const PdfGuestSchema = z
  .object({
    name: optionalText(120),
    phone: optionalText(40),
    arrival: optionalDateString,
    departure: optionalDateString,
    adults: optionalCount.optional(),
    children: optionalCount.optional(),
  })
  .refine((v) => !v.arrival || !v.departure || v.departure >= v.arrival, {
    path: ["departure"],
    message: "Departure can't be before arrival",
  })

export type PdfGuestValues = z.input<typeof PdfGuestSchema>

/** What the PDF prints in its guest box. Every field is optional. */
export interface PdfGuest {
  name?: string | null
  phone?: string | null
  /** YYYY-MM-DD */
  arrival?: string | null
  /** YYYY-MM-DD; worked out from arrival + nights when left out. */
  departure?: string | null
  adults?: number | null
  children?: number | null
  infants?: number | null
}

const KEYS = ["name", "phone", "arrival", "departure", "adults", "children"] as const

/** Query string for the download route; empty values are left out. */
export function pdfGuestQuery(values: PdfGuestValues): string {
  const params = new URLSearchParams()
  for (const key of KEYS) {
    const value = values[key]
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) params.set(key, text)
  }
  return params.toString()
}

/** Reads the guest back out of a download URL; null when none was sent or it's invalid. */
export function parsePdfGuestQuery(params: URLSearchParams): PdfGuest | null {
  if (!KEYS.some((key) => params.has(key))) return null
  const parsed = PdfGuestSchema.safeParse(Object.fromEntries(params))
  return parsed.success ? parsed.data : null
}
