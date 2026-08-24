import {
  type AnyPgColumn,
  boolean,
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
import { leads } from "./lead.schema"
import { users } from "./user.schema"

/**
 * Packages and custom quotes are the same shape, so they share one table.
 *
 * - `package` — a reusable, marketable product ("Munnar 3N/4D"). Not tied to a
 *   customer, can be published and shown off via its share link.
 * - `custom`  — built for one lead/customer, optionally seeded from a package.
 */
export const itineraryKindEnum = pgEnum("itinerary_kind", ["package", "custom"])

export const itineraryStatusEnum = pgEnum("itinerary_status", [
  "draft",
  "published", // packages only — visible on the public catalogue
  "sent", // custom only — shared with the customer, awaiting response
  "accepted",
  "rejected",
  "archived",
])

export const pricingModeEnum = pgEnum("pricing_mode", ["per_pax", "fixed"])

export const itineraries = pgTable(
  "itineraries",
  {
    id: pk(),
    /** e.g. PKG-000012 or QUO-000345. */
    code: text("code").notNull(),
    kind: itineraryKindEnum("kind").notNull().default("custom"),
    title: text("title").notNull(),
    /** Opaque token for the public share URL at /i/<shareToken>. */
    shareToken: text("share_token").notNull(),
    isShareEnabled: boolean("is_share_enabled").notNull().default(true),
    /** Null means never expires (older tokens); new/regenerated tokens get one. */
    shareTokenExpiresAt: timestamp("share_token_expires_at", { withTimezone: true }),

    // Linkage — null for packages, set for custom quotes.
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id),
    /** Set when a custom quote was seeded from a package. */
    sourcePackageId: uuid("source_package_id").references(
      (): AnyPgColumn => itineraries.id
    ),

    // Versioning — clients change their minds; keep v1, v2, v3.
    version: integer("version").notNull().default(1),
    parentItineraryId: uuid("parent_itinerary_id").references(
      (): AnyPgColumn => itineraries.id
    ),

    destination: text("destination"),
    durationDays: integer("duration_days").notNull().default(1),
    durationNights: integer("duration_nights").notNull().default(0),
    summary: text("summary"),
    coverImageUrl: text("cover_image_url"),

    // Pricing
    pricingMode: pricingModeEnum("pricing_mode").notNull().default("fixed"),
    pricePerAdult: money("price_per_adult"),
    pricePerChild: money("price_per_child"),
    fixedPrice: money("fixed_price"),
    /** Snapshot of the estimated internal cost, for margin preview at quote time. */
    estimatedCost: money("estimated_cost"),

    inclusions: text("inclusions").array(),
    exclusions: text("exclusions").array(),
    termsAndConditions: text("terms_and_conditions"),

    status: itineraryStatusEnum("status").notNull().default("draft"),
    validUntil: date("valid_until"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    /** Bumped whenever the public share link is opened. */
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),

    createdBy: actor("created_by").references(() => users.id),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("itineraries_code_key").on(t.code),
    uniqueIndex("itineraries_share_token_key").on(t.shareToken),
    index("itineraries_kind_status_idx").on(t.kind, t.status),
    index("itineraries_lead_idx").on(t.leadId),
    index("itineraries_customer_idx").on(t.customerId),
  ]
)

/** One row per day of the trip. */
export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: pk(),
    itineraryId: uuid("itinerary_id")
      .notNull()
      .references(() => itineraries.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Free-text stay note, e.g. "Overnight at Tea Valley Resort, Munnar". */
    stayNote: text("stay_note"),
    breakfast: boolean("breakfast").notNull().default(false),
    lunch: boolean("lunch").notNull().default(false),
    dinner: boolean("dinner").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("itinerary_days_unique").on(t.itineraryId, t.dayNumber),
    index("itinerary_days_itinerary_idx").on(t.itineraryId),
  ]
)

/**
 * Photos attached to an itinerary or to one specific day.
 * `dayId` null = gallery image for the whole itinerary.
 */
export const itineraryImages = pgTable(
  "itinerary_images",
  {
    id: pk(),
    itineraryId: uuid("itinerary_id")
      .notNull()
      .references(() => itineraries.id, { onDelete: "cascade" }),
    dayId: uuid("day_id").references(() => itineraryDays.id, {
      onDelete: "cascade",
    }),
    url: text("url").notNull(),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("itinerary_images_itinerary_idx").on(t.itineraryId, t.sortOrder),
    index("itinerary_images_day_idx").on(t.dayId),
  ]
)

export type Itinerary = typeof itineraries.$inferSelect
export type NewItinerary = typeof itineraries.$inferInsert
export type ItineraryDay = typeof itineraryDays.$inferSelect
export type NewItineraryDay = typeof itineraryDays.$inferInsert
export type ItineraryImage = typeof itineraryImages.$inferSelect
export type NewItineraryImage = typeof itineraryImages.$inferInsert
