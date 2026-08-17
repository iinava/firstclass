import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, money, pk, softDelete, timestamps } from "./_shared"
import { suppliers } from "./supplier.schema"

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "hatchback",
  "sedan",
  "suv",
  "tempo_traveller",
  "mini_bus",
  "bus",
  "bike",
  "other",
])

export const ownershipEnum = pgEnum("ownership", ["owned", "hired"])

export const drivers = pgTable(
  "drivers",
  {
    id: pk(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    licenseNumber: text("license_number"),
    licenseExpiry: date("license_expiry"),
    address: text("address"),
    /** Per-day allowance (bata) used to pre-fill trip cost lines. */
    dailyAllowance: money("daily_allowance"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("drivers_active_idx").on(t.isActive)]
)

export const vehicles = pgTable(
  "vehicles",
  {
    id: pk(),
    regNumber: text("reg_number").notNull(),
    type: vehicleTypeEnum("type").notNull().default("suv"),
    make: text("make"),
    model: text("model"),
    seatingCapacity: integer("seating_capacity").notNull().default(4),
    ownership: ownershipEnum("ownership").notNull().default("owned"),
    /** Set when ownership = 'hired'. */
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    defaultDriverId: uuid("default_driver_id").references(() => drivers.id),
    /** Standing rates used to pre-fill costs — actuals are logged per trip. */
    ratePerKm: money("rate_per_km"),
    ratePerDay: money("rate_per_day"),
    insuranceExpiry: date("insurance_expiry"),
    fitnessExpiry: date("fitness_expiry"),
    pucExpiry: date("puc_expiry"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("vehicles_reg_number_key").on(t.regNumber),
    index("vehicles_active_idx").on(t.isActive),
    index("vehicles_ownership_idx").on(t.ownership),
  ]
)

/**
 * A vehicle blocked out for a booking over a date range.
 * Overlap detection lives in the service layer — see `lib/services/vehicle.ts`.
 */
export const vehicleAssignments = pgTable(
  "vehicle_assignments",
  {
    id: pk(),
    bookingId: uuid("booking_id").notNull(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),
    driverId: uuid("driver_id").references(() => drivers.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    startOdometer: integer("start_odometer"),
    endOdometer: integer("end_odometer"),
    notes: text("notes"),
    createdBy: actor("created_by"),
    ...timestamps,
  },
  (t) => [
    index("vehicle_assignments_vehicle_dates_idx").on(
      t.vehicleId,
      t.startDate,
      t.endDate
    ),
    index("vehicle_assignments_booking_idx").on(t.bookingId),
    index("vehicle_assignments_driver_idx").on(t.driverId),
  ]
)

export type Vehicle = typeof vehicles.$inferSelect
export type NewVehicle = typeof vehicles.$inferInsert
export type Driver = typeof drivers.$inferSelect
export type NewDriver = typeof drivers.$inferInsert
export type VehicleAssignment = typeof vehicleAssignments.$inferSelect
export type NewVehicleAssignment = typeof vehicleAssignments.$inferInsert
