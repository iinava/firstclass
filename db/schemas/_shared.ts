/**
 * Shared column builders and enums used across every domain schema.
 *
 * NOTE: this file intentionally exports no tables — drizzle-kit picks it up via
 * the `./db/schemas/*.ts` glob but only collects table/enum definitions.
 *
 * MONEY: every monetary value in this system is stored as an INTEGER number of
 * paise (1 rupee = 100 paise) using bigint. Never use floats for money — see
 * `lib/money.ts` for the formatting/parsing helpers.
 */
import { bigint, timestamp, uuid } from "drizzle-orm/pg-core"

/** Monetary amount in paise. Use `toPaise()` / `formatMoney()` from lib/money.ts. */
export const money = (name: string) => bigint(name, { mode: "number" })

/** created_at / updated_at pair applied to every table. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
}

/**
 * Soft delete marker. Financial and customer records are never hard-deleted —
 * all queries must filter on `isNull(table.deletedAt)`.
 */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}

/** Primary key used by every table. */
export const pk = () => uuid("id").defaultRandom().primaryKey()

/** Nullable audit reference to the acting user. */
export const actor = (name: string) => uuid(name)
