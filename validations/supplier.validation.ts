import { z } from "zod"
import {
  listParamsSchema,
  moneySchema,
  optionalDateString,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const SUPPLIER_TYPES = [
  "hotel",
  "homestay",
  "resort",
  "transport",
  "guide",
  "activity",
  "restaurant",
  "airline",
  "agent",
  "other",
] as const

export const supplierTypeSchema = z.enum(SUPPLIER_TYPES)

export const SUPPLIER_TYPE_LABELS: Record<(typeof SUPPLIER_TYPES)[number], string> = {
  hotel: "Hotel",
  homestay: "Homestay",
  resort: "Resort",
  transport: "Transport",
  guide: "Guide",
  activity: "Activity",
  restaurant: "Restaurant",
  airline: "Airline",
  agent: "Agent",
  other: "Other",
}

export const SupplierFormSchema = z.object({
  name: requiredText("Name", 160),
  type: supplierTypeSchema.default("hotel"),
  contactPerson: optionalText(120),
  phone: optionalPhoneSchema,
  altPhone: optionalPhoneSchema,
  email: optionalEmailSchema,
  address: optionalText(500),
  city: optionalText(80),
  state: optionalText(80),
  gstin: optionalText(20),
  paymentTerms: optionalText(300),
  bankDetails: optionalText(500),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  notes: optionalText(2000),
  isActive: z.boolean().default(true),
})

export const CreateSupplierSchema = SupplierFormSchema
export const UpdateSupplierSchema = SupplierFormSchema.extend({ id: uuidSchema })
export const DeleteSupplierSchema = z.object({ id: uuidSchema })

export const SupplierListParamsSchema = listParamsSchema.extend({
  type: supplierTypeSchema.optional(),
  isActive: z.enum(["true", "false"]).optional(),
})

// ---------------------------------------------------------------- rate cards

export const SupplierRateFormSchema = z
  .object({
    supplierId: uuidSchema,
    title: requiredText("Title", 160),
    unit: requiredText("Unit", 40),
    rate: moneySchema,
    validFrom: optionalDateString,
    validTo: optionalDateString,
    notes: optionalText(300),
  })
  .refine((v) => !v.validFrom || !v.validTo || v.validTo >= v.validFrom, {
    message: "Valid-to date cannot be before the valid-from date",
    path: ["validTo"],
  })

export const UpdateSupplierRateSchema = z.intersection(
  SupplierRateFormSchema,
  z.object({ id: uuidSchema })
)

export const DeleteSupplierRateSchema = z.object({ id: uuidSchema })

export type SupplierFormValues = z.input<typeof SupplierFormSchema>
export type SupplierListParams = z.output<typeof SupplierListParamsSchema>
export type SupplierRateValues = z.input<typeof SupplierRateFormSchema>
