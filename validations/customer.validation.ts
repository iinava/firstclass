import { z } from "zod"
import {
  listParamsSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalText,
  phoneSchema,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const LEAD_SOURCES = [
  "walk_in",
  "phone",
  "referral",
  "instagram",
  "whatsapp",
  "facebook",
  "website",
  "repeat",
  "other",
] as const

export const leadSourceSchema = z.enum(LEAD_SOURCES)

export const SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
  walk_in: "Walk-in",
  phone: "Phone call",
  referral: "Referral",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  website: "Website",
  repeat: "Repeat customer",
  other: "Other",
}

export const CustomerFormSchema = z.object({
  name: requiredText("Name", 120),
  phone: phoneSchema,
  altPhone: optionalPhoneSchema,
  email: optionalEmailSchema,
  address: optionalText(500),
  city: optionalText(80),
  state: optionalText(80),
  pincode: optionalText(10),
  source: leadSourceSchema.default("walk_in"),
  gstin: optionalText(20),
  notes: optionalText(2000),
})

export const CreateCustomerSchema = CustomerFormSchema

export const UpdateCustomerSchema = CustomerFormSchema.extend({
  id: uuidSchema,
})

export const DeleteCustomerSchema = z.object({ id: uuidSchema })

export const CustomerListParamsSchema = listParamsSchema.extend({
  source: leadSourceSchema.optional(),
  city: z.string().trim().optional(),
})

export type CustomerFormValues = z.input<typeof CustomerFormSchema>
export type CreateCustomerInput = z.output<typeof CreateCustomerSchema>
export type UpdateCustomerInput = z.output<typeof UpdateCustomerSchema>
export type CustomerListParams = z.output<typeof CustomerListParamsSchema>
