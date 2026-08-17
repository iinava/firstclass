import { z } from "zod"
import {
  dateStringSchema,
  listParamsSchema,
  moneySchema,
  optionalDateString,
  optionalMoneySchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const BOOKING_STATUSES = [
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const

export const PRICING_MODES = ["per_pax", "fixed"] as const

export const bookingStatusSchema = z.enum(BOOKING_STATUSES)
export const pricingModeSchema = z.enum(PRICING_MODES)

export const BOOKING_STATUS_LABELS: Record<(typeof BOOKING_STATUSES)[number], string> = {
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

/**
 * Bookings are created either from an accepted quote or straight from a phone
 * call. `customerId` is required — a trip always belongs to someone.
 */
export const BookingFormSchema = z
  .object({
    customerId: uuidSchema,
    leadId: uuidSchema.nullable().optional(),
    itineraryId: uuidSchema.nullable().optional(),
    title: requiredText("Trip name", 200),
    destination: optionalText(160),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    adults: z.coerce.number().int().min(1, "At least 1 adult").max(200).default(1),
    children: z.coerce.number().int().min(0).max(200).default(0),
    infants: z.coerce.number().int().min(0).max(200).default(0),

    pricingMode: pricingModeSchema.default("fixed"),
    pricePerAdult: optionalMoneySchema,
    pricePerChild: optionalMoneySchema,
    /** Used when pricingMode is "fixed". */
    sellSubtotal: moneySchema.default(0),
    discount: moneySchema.default(0),
    /** GST percentage as entered (5 -> stored as 500 bps). */
    taxRatePercent: z.coerce.number().min(0).max(50).default(0),

    assignedTo: uuidSchema.nullable().optional(),
    notes: optionalText(2000),
    internalNotes: optionalText(2000),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  })
  .refine(
    (v) => v.pricingMode !== "per_pax" || (v.pricePerAdult ?? 0) > 0,
    { message: "Enter a per-adult price", path: ["pricePerAdult"] }
  )
  .refine(
    (v) => v.pricingMode !== "fixed" || v.sellSubtotal > 0,
    { message: "Enter the package price", path: ["sellSubtotal"] }
  )

export const CreateBookingSchema = BookingFormSchema
export const UpdateBookingSchema = z.intersection(
  BookingFormSchema,
  z.object({ id: uuidSchema })
)

export const UpdateBookingStatusSchema = z.object({
  id: uuidSchema,
  status: bookingStatusSchema,
})

export const CancelBookingSchema = z.object({
  id: uuidSchema,
  cancellationReason: requiredText("Reason", 500),
  cancellationCharge: optionalMoneySchema,
})

export const DeleteBookingSchema = z.object({ id: uuidSchema })

export const BookingListParamsSchema = listParamsSchema.extend({
  status: bookingStatusSchema.optional(),
  customerId: z.string().optional(),
  assignedTo: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// ------------------------------------------------------------------ pax list

export const BookingPaxSchema = z.object({
  bookingId: uuidSchema,
  name: requiredText("Name", 120),
  age: z.coerce.number().int().min(0).max(120).nullable().optional(),
  gender: optionalText(20),
  phone: optionalText(20),
  idType: optionalText(40),
  idNumber: optionalText(40),
  notes: optionalText(300),
})

export const DeletePaxSchema = z.object({ id: uuidSchema })

// --------------------------------------------------------------- trip costing

export const COST_CATEGORIES = [
  "hotel",
  "transport",
  "flight",
  "train",
  "guide",
  "activity",
  "meal",
  "permit",
  "driver_allowance",
  "fuel",
  "toll_parking",
  "misc",
] as const

export const COST_STATUSES = ["planned", "booked", "cancelled"] as const

export const costCategorySchema = z.enum(COST_CATEGORIES)
export const costStatusSchema = z.enum(COST_STATUSES)

export const COST_CATEGORY_LABELS: Record<(typeof COST_CATEGORIES)[number], string> = {
  hotel: "Hotel",
  transport: "Transport",
  flight: "Flight",
  train: "Train",
  guide: "Guide",
  activity: "Activity",
  meal: "Meals",
  permit: "Permits",
  driver_allowance: "Driver allowance",
  fuel: "Fuel",
  toll_parking: "Tolls & parking",
  misc: "Miscellaneous",
}

export const TripCostFormSchema = z.object({
  bookingId: uuidSchema,
  category: costCategorySchema,
  supplierId: uuidSchema.nullable().optional(),
  vehicleId: uuidSchema.nullable().optional(),
  description: requiredText("Description", 300),
  serviceDate: optionalDateString,
  quantity: z.coerce.number().int().min(1, "At least 1").max(9999).default(1),
  unitCost: moneySchema,
  sellAmount: moneySchema.default(0),
  status: costStatusSchema.default("planned"),
  confirmationNo: optionalText(80),
  notes: optionalText(500),
})

export const UpdateTripCostSchema = TripCostFormSchema.extend({ id: uuidSchema })
export const DeleteTripCostSchema = z.object({ id: uuidSchema })

export type BookingFormValues = z.input<typeof BookingFormSchema>
export type BookingListParams = z.output<typeof BookingListParamsSchema>
export type TripCostValues = z.input<typeof TripCostFormSchema>
export type BookingPaxValues = z.input<typeof BookingPaxSchema>
