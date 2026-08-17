// db/schemas/user.schema.ts
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { timestamps } from "./_shared"

/**
 * Roles are hierarchical — see `lib/rbac.ts` for the permission matrix.
 *
 *   superadmin  everything, including user management and destructive actions
 *   admin       everything except user management
 *   manager     all operational data + reports, no settings
 *   accounts    money (invoices, receipts, payments, expenses) + reports
 *   sales       own leads, customers, itineraries, bookings
 *   ops         bookings, suppliers, vehicles, trip costs
 *   staff       read-only fallback
 */
export const userRoleEnum = pgEnum("role", [
  "superadmin",
  "admin",
  "staff",
  "manager",
  "accounts",
  "sales",
  "ops",
])

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("staff"),
    email: text("email").unique(),
    name: text("name"),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  // username/email uniqueness is already enforced by the inline .unique() above.
  (t) => [index("users_role_idx").on(t.role)]
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
