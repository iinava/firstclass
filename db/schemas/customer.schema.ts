import { index, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { actor, pk, softDelete, timestamps } from "./_shared"

export const leadSourceEnum = pgEnum("lead_source", [
  "walk_in",
  "phone",
  "referral",
  "instagram",
  "whatsapp",
  "facebook",
  "website",
  "repeat",
  "other",
])

/**
 * Customer master. Deduplicated on phone — a repeat customer is the highest
 * value lead this business has, so the phone number is the identity key.
 */
export const customers = pgTable(
  "customers",
  {
    id: pk(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    altPhone: text("alt_phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    /** How this customer first reached the business. */
    source: leadSourceEnum("source").notNull().default("walk_in"),
    gstin: text("gstin"),
    notes: text("notes"),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    // Partial-unique on phone would be ideal but drizzle-kit RC has patchy
    // support for `.where()` on unique indexes — enforced in the service layer
    // via findByPhone() plus this index for lookup speed.
    uniqueIndex("customers_phone_key").on(t.phone),
    index("customers_name_idx").on(t.name),
    index("customers_deleted_at_idx").on(t.deletedAt),
  ]
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
