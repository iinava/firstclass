// db/schemas/user.schema.ts
import { pgTable, text, uuid, pgEnum, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("role", ["superadmin", "admin", "staff"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("staff"),
  email: text("email").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
