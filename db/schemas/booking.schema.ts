import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, money, pk, softDelete, timestamps } from "./_shared"
import { customers } from "./customer.schema"
import { itineraries, pricingModeEnum } from "./itinerary.schema"
import { leads } from "./lead.schema"
import { users } from "./user.schema"

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
])

/**
 * The profit centre of the whole system. Every cost, receipt, vehicle-day and
 * expense hangs off a booking — which is what makes "revenue & expense by trip"
 * a single GROUP BY rather than a reconciliation exercise.
 *
 * All amounts are in paise. `grandTotal` is what the customer owes:
 *   grandTotal = sellSubtotal - discount + taxAmount
 */
export const bookings = pgTable(
  "bookings",
  {
    id: pk(),
    /** e.g. FC-2026-000045. */
    code: text("code").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    /** The accepted quote this booking was created from. */
    itineraryId: uuid("itinerary_id").references(() => itineraries.id),

    title: text("title").notNull(),
    destination: text("destination"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),

    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    infants: integer("infants").notNull().default(0),

    // ---- Money ----
    pricingMode: pricingModeEnum("pricing_mode").notNull().default("fixed"),
    pricePerAdult: money("price_per_adult"),
    pricePerChild: money("price_per_child"),
    /** Sum before discount and tax. */
    sellSubtotal: money("sell_subtotal").notNull().default(0),
    discount: money("discount").notNull().default(0),
    /** GST percentage x 100 (e.g. 5% -> 500) so it stays an integer. */
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    taxAmount: money("tax_amount").notNull().default(0),
    grandTotal: money("grand_total").notNull().default(0),

    status: bookingStatusEnum("status").notNull().default("confirmed"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    /** Non-refundable amount retained on cancellation. */
    cancellationCharge: money("cancellation_charge"),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdBy: actor("created_by").references(() => users.id),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("bookings_code_key").on(t.code),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_status_idx").on(t.status),
    index("bookings_start_date_idx").on(t.startDate),
    index("bookings_assigned_idx").on(t.assignedTo),
  ]
)

/** Passenger manifest — needed for hotel check-in and permits. */
export const bookingPax = pgTable(
  "booking_pax",
  {
    id: pk(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    age: integer("age"),
    gender: text("gender"),
    phone: text("phone"),
    idType: text("id_type"),
    idNumber: text("id_number"),
    isLead: integer("is_lead").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("booking_pax_booking_idx").on(t.bookingId)]
)

export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert
export type BookingPax = typeof bookingPax.$inferSelect
export type NewBookingPax = typeof bookingPax.$inferInsert
