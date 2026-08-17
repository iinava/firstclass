import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, money, pk, softDelete, timestamps } from "./_shared"
import { bookings } from "./booking.schema"
import { suppliers } from "./supplier.schema"
import { vehicles } from "./vehicle.schema"

export const costCategoryEnum = pgEnum("cost_category", [
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
])

export const costStatusEnum = pgEnum("cost_status", [
  "planned",
  "booked",
  "cancelled",
])

export const payableStatusEnum = pgEnum("payable_status", [
  "unpaid",
  "partial",
  "paid",
])

/**
 * The single most important table in the system.
 *
 * One row per thing procured for a trip — a hotel booking, a vehicle, a guide,
 * park entry tickets. Each row carries BOTH what it cost the business and what
 * it was sold to the customer for, so margin is derivable at any grain:
 *
 *   profit by trip     -> GROUP BY booking_id
 *   expense by category-> GROUP BY category
 *   supplier spend     -> GROUP BY supplier_id
 *   vehicle cost/trip  -> WHERE vehicle_id IS NOT NULL GROUP BY booking_id
 */
export const tripCostItems = pgTable(
  "trip_cost_items",
  {
    id: pk(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    category: costCategoryEnum("category").notNull(),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    /** Set for transport lines so vehicle-wise expense reports work. */
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),

    description: text("description").notNull(),
    serviceDate: date("service_date"),
    /** Nights for hotels, days for vehicles, heads for tickets. */
    quantity: integer("quantity").notNull().default(1),
    unitCost: money("unit_cost").notNull().default(0),
    /** quantity x unitCost — denormalised so reports never recompute. */
    costAmount: money("cost_amount").notNull().default(0),
    /** What the customer is charged for this line. 0 = bundled into package price. */
    sellAmount: money("sell_amount").notNull().default(0),

    status: costStatusEnum("status").notNull().default("planned"),
    paymentStatus: payableStatusEnum("payment_status").notNull().default("unpaid"),
    /** Running total of supplier payments applied to this line. */
    paidAmount: money("paid_amount").notNull().default(0),

    confirmationNo: text("confirmation_no"),
    notes: text("notes"),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("trip_cost_items_booking_idx").on(t.bookingId),
    index("trip_cost_items_category_idx").on(t.category),
    index("trip_cost_items_supplier_idx").on(t.supplierId),
    index("trip_cost_items_vehicle_idx").on(t.vehicleId),
    index("trip_cost_items_service_date_idx").on(t.serviceDate),
  ]
)

export type TripCostItem = typeof tripCostItems.$inferSelect
export type NewTripCostItem = typeof tripCostItems.$inferInsert
