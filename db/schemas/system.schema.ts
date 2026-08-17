import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, pk, timestamps } from "./_shared"

/**
 * Atomic sequence source for human-facing document numbers (LEAD-000123,
 * FC/26-27/0001, ...). Incremented with a single `UPDATE ... RETURNING`, which
 * is atomic on its own row and therefore safe without an outer transaction.
 *
 * `scope` partitions a counter — usually a financial year ("26-27") or "global".
 */
export const counters = pgTable(
  "counters",
  {
    id: pk(),
    key: text("key").notNull(),
    scope: text("scope").notNull().default("global"),
    value: integer("value").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("counters_key_scope_key").on(t.key, t.scope)]
)

/**
 * Append-only audit trail. Written for every mutation on financial and
 * customer-facing records — required before anyone will trust the P&L numbers.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    /** Table name, e.g. "bookings". */
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    /** create | update | delete | void | status_change | login | ... */
    action: text("action").notNull(),
    /** Changed fields only, as { field: { from, to } }. */
    changes: jsonb("changes"),
    summary: text("summary"),
    userId: actor("user_id"),
    userName: text("user_name"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entity, t.entityId),
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_user_idx").on(t.userId),
  ]
)

/**
 * Single-row org profile + defaults. Keyed by `key` so it doubles as a generic
 * settings store without a migration for every new toggle.
 */
export const appSettings = pgTable(
  "app_settings",
  {
    id: pk(),
    key: text("key").notNull(),
    value: jsonb("value"),
    ...timestamps,
  },
  (t) => [uniqueIndex("app_settings_key_key").on(t.key)]
)

export type Counter = typeof counters.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type AppSetting = typeof appSettings.$inferSelect
