import { z } from "zod"
import {
  dateStringSchema,
  listParamsSchema,
  optionalDateString,
  optionalMoneySchema,
  optionalText,
  phoneSchema,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const VEHICLE_TYPES = [
  "hatchback",
  "sedan",
  "suv",
  "tempo_traveller",
  "mini_bus",
  "bus",
  "bike",
  "other",
] as const

export const OWNERSHIP = ["owned", "hired"] as const

export const vehicleTypeSchema = z.enum(VEHICLE_TYPES)
export const ownershipSchema = z.enum(OWNERSHIP)

export const VEHICLE_TYPE_LABELS: Record<(typeof VEHICLE_TYPES)[number], string> = {
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  tempo_traveller: "Tempo Traveller",
  mini_bus: "Mini Bus",
  bus: "Bus",
  bike: "Bike",
  other: "Other",
}

export const VehicleFormSchema = z.object({
  regNumber: requiredText("Registration number", 20).transform((v) =>
    v.toUpperCase().replace(/\s+/g, "")
  ),
  type: vehicleTypeSchema.default("suv"),
  make: optionalText(60),
  model: optionalText(60),
  seatingCapacity: z.coerce.number().int().min(1).max(80).default(4),
  ownership: ownershipSchema.default("owned"),
  supplierId: uuidSchema.nullable().optional(),
  defaultDriverId: uuidSchema.nullable().optional(),
  ratePerKm: optionalMoneySchema,
  ratePerDay: optionalMoneySchema,
  mileageKmpl: z.coerce.number().min(0).max(200).optional().nullable(),
  fuelPricePerLitre: optionalMoneySchema,
  insuranceExpiry: optionalDateString,
  fitnessExpiry: optionalDateString,
  pucExpiry: optionalDateString,
  isActive: z.boolean().default(true),
  notes: optionalText(1000),
})

export const CreateVehicleSchema = VehicleFormSchema
export const UpdateVehicleSchema = VehicleFormSchema.extend({ id: uuidSchema })
export const DeleteVehicleSchema = z.object({ id: uuidSchema })

export const VehicleListParamsSchema = listParamsSchema.extend({
  type: vehicleTypeSchema.optional(),
  ownership: ownershipSchema.optional(),
  isActive: z.enum(["true", "false"]).optional(),
})

// ------------------------------------------------------------------- drivers

export const DriverFormSchema = z.object({
  name: requiredText("Name", 120),
  phone: phoneSchema,
  licenseNumber: optionalText(40),
  licenseExpiry: optionalDateString,
  address: optionalText(300),
  dailyAllowance: optionalMoneySchema,
  isActive: z.boolean().default(true),
  notes: optionalText(500),
})

export const CreateDriverSchema = DriverFormSchema
export const UpdateDriverSchema = DriverFormSchema.extend({ id: uuidSchema })
export const DeleteDriverSchema = z.object({ id: uuidSchema })

// --------------------------------------------------------------- assignments

export const AssignVehicleSchema = z
  .object({
    bookingId: uuidSchema,
    vehicleId: uuidSchema,
    driverId: uuidSchema.nullable().optional(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    startOdometer: z.coerce.number().int().min(0).nullable().optional(),
    notes: optionalText(300),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  })

export const UpdateAssignmentSchema = z
  .object({
    id: uuidSchema,
    driverId: uuidSchema.nullable().optional(),
    startOdometer: z.coerce.number().int().min(0).nullable().optional(),
    endOdometer: z.coerce.number().int().min(0).nullable().optional(),
    notes: optionalText(300),
  })
  .refine(
    (v) =>
      v.startOdometer == null || v.endOdometer == null || v.endOdometer >= v.startOdometer,
    { message: "End odometer cannot be before the start odometer", path: ["endOdometer"] }
  )

export const DeleteAssignmentSchema = z.object({ id: uuidSchema })

export type VehicleFormValues = z.input<typeof VehicleFormSchema>
export type DriverFormValues = z.input<typeof DriverFormSchema>
export type VehicleListParams = z.output<typeof VehicleListParamsSchema>
export type AssignVehicleValues = z.input<typeof AssignVehicleSchema>
