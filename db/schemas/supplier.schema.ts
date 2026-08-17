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

export const supplierTypeEnum = pgEnum("supplier_type", [
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
])

/** Hotels, transporters, guides, activity vendors — anyone the business buys from. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: pk(),
    name: text("name").notNull(),
    type: supplierTypeEnum("type").notNull().default("hotel"),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    altPhone: text("alt_phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    gstin: text("gstin"),
    /** Free text, e.g. "50% advance, balance on checkout". */
    paymentTerms: text("payment_terms"),
    bankDetails: text("bank_details"),
    /** 1–5, set manually by ops. Drives the "supplier performance" report. */
    rating: integer("rating"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("suppliers_name_idx").on(t.name),
    index("suppliers_type_idx").on(t.type),
    index("suppliers_active_idx").on(t.isActive),
  ]
)

/** Contracted rate card per supplier, e.g. "Deluxe room, per night, ₹3200". */
export const supplierRates = pgTable(
  "supplier_rates",
  {
    id: pk(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** e.g. "per night", "per day", "per person", "per trip". */
    unit: text("unit").notNull().default("per night"),
    rate: money("rate").notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("supplier_rates_supplier_idx").on(t.supplierId),
    uniqueIndex("supplier_rates_supplier_title_key").on(t.supplierId, t.title),
  ]
)

export type Supplier = typeof suppliers.$inferSelect
export type NewSupplier = typeof suppliers.$inferInsert
export type SupplierRate = typeof supplierRates.$inferSelect
export type NewSupplierRate = typeof supplierRates.$inferInsert
