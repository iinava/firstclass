import { z } from "zod"
import {
  listParamsSchema,
  optionalDateString,
  optionalMoneySchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const ITINERARY_KINDS = ["package", "custom"] as const
export const ITINERARY_STATUSES = [
  "draft",
  "published",
  "sent",
  "accepted",
  "rejected",
  "archived",
] as const

export const itineraryKindSchema = z.enum(ITINERARY_KINDS)
export const itineraryStatusSchema = z.enum(ITINERARY_STATUSES)

export const ITINERARY_STATUS_LABELS: Record<
  (typeof ITINERARY_STATUSES)[number],
  string
> = {
  draft: "Draft",
  published: "Published",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  archived: "Archived",
}

export const ItineraryFormSchema = z.object({
  kind: itineraryKindSchema.default("package"),
  title: requiredText("Title", 200),
  destination: optionalText(160),
  durationDays: z.coerce.number().int().min(1, "At least 1 day").max(90).default(1),
  durationNights: z.coerce.number().int().min(0).max(90).default(0),
  summary: optionalText(2000),
  coverImageUrl: optionalText(500),

  leadId: uuidSchema.nullable().optional(),
  customerId: uuidSchema.nullable().optional(),

  pricingMode: z.enum(["per_pax", "fixed"]).default("per_pax"),
  pricePerAdult: optionalMoneySchema,
  pricePerChild: optionalMoneySchema,
  fixedPrice: optionalMoneySchema,

  /** Free-text lines, one per bullet on the shared page. */
  inclusions: z.array(z.string().trim().min(1)).default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),
  termsAndConditions: optionalText(4000),
  validUntil: optionalDateString,
})

export const CreateItinerarySchema = ItineraryFormSchema
export const UpdateItinerarySchema = ItineraryFormSchema.extend({ id: uuidSchema })
export const DeleteItinerarySchema = z.object({ id: uuidSchema })

export const UpdateItineraryStatusSchema = z.object({
  id: uuidSchema,
  status: itineraryStatusSchema,
})

export const ToggleShareSchema = z.object({
  id: uuidSchema,
  isShareEnabled: z.boolean(),
})

export const ItineraryListParamsSchema = listParamsSchema.extend({
  kind: itineraryKindSchema.optional(),
  status: itineraryStatusSchema.optional(),
})

// ---------------------------------------------------------------------- days

export const ItineraryDaySchema = z.object({
  itineraryId: uuidSchema,
  dayNumber: z.coerce.number().int().min(1).max(90),
  title: requiredText("Day title", 200),
  description: optionalText(4000),
  stayNote: optionalText(300),
  breakfast: z.boolean().default(false),
  lunch: z.boolean().default(false),
  dinner: z.boolean().default(false),
})

export const UpdateItineraryDaySchema = ItineraryDaySchema.extend({ id: uuidSchema })
export const DeleteItineraryDaySchema = z.object({ id: uuidSchema })

// -------------------------------------------------------------------- images

export const ItineraryImageSchema = z.object({
  itineraryId: uuidSchema,
  dayId: uuidSchema.nullable().optional(),
  url: z.url("Enter a valid image URL"),
  caption: optionalText(200),
  sortOrder: z.coerce.number().int().min(0).default(0),
})

export const DeleteItineraryImageSchema = z.object({ id: uuidSchema })

/** Seeds a custom quote from an existing package. */
export const CloneItinerarySchema = z.object({
  sourceId: uuidSchema,
  leadId: uuidSchema.nullable().optional(),
  customerId: uuidSchema.nullable().optional(),
  title: optionalText(200),
})

export type ItineraryFormValues = z.input<typeof ItineraryFormSchema>
export type ItineraryDayValues = z.input<typeof ItineraryDaySchema>
export type ItineraryImageValues = z.input<typeof ItineraryImageSchema>
export type ItineraryListParams = z.output<typeof ItineraryListParamsSchema>
