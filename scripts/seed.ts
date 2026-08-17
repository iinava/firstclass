/**
 * Seed script — creates the first superadmin user.
 * Reads credentials from environment variables.
 *
 * Required:
 *   SEED_ADMIN_USERNAME
 *   SEED_ADMIN_PASSWORD
 * Optional:
 *   SEED_ADMIN_EMAIL
 *
 * Usage:
 *   npm run db:seed
 *   (or: tsx --env-file=.env.local scripts/seed.ts)
 *
 * Idempotent — skips if the username already exists.
 */

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq } from "drizzle-orm"
import { users } from "../db/schemas/user.schema"
import { expenseCategories } from "../db/schemas/accounts.schema"
import { hashPassword } from "../lib/password"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle({ client: sql })

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME
  const password = process.env.SEED_ADMIN_PASSWORD
  const email = process.env.SEED_ADMIN_EMAIL ?? null

  if (!username || !password) {
    console.error("❌ SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must be set in .env.local")
    process.exit(1)
  }

  console.log(`▶ Seeding superadmin: ${username}`)

  // Check if user already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (existing) {
    console.log(`⚠ User "${username}" already exists — skipping.`)
    // Categories are seeded independently, so a re-run still tops them up.
    await seedExpenseCategories()
    process.exit(0)
  }

  const passwordHash = await hashPassword(password)

  await db.insert(users).values({
    username,
    passwordHash,
    role: "superadmin",
    email,
  })

  console.log(`✅ Superadmin "${username}" created successfully!`)

  await seedExpenseCategories()
  process.exit(0)
}

/**
 * Starter expense buckets so the Expenses screen is usable on day one.
 * Idempotent — existing names are left alone.
 */
async function seedExpenseCategories() {
  const defaults: { name: string; isTripRelated: boolean }[] = [
    { name: "Fuel", isTripRelated: true },
    { name: "Tolls & parking", isTripRelated: true },
    { name: "Driver allowance", isTripRelated: true },
    { name: "Vehicle maintenance", isTripRelated: true },
    { name: "Guide & entry tickets", isTripRelated: true },
    { name: "Meals on trip", isTripRelated: true },
    { name: "Office rent", isTripRelated: false },
    { name: "Salaries", isTripRelated: false },
    { name: "Marketing", isTripRelated: false },
    { name: "Utilities & internet", isTripRelated: false },
    { name: "Miscellaneous", isTripRelated: false },
  ]

  const inserted = await db
    .insert(expenseCategories)
    .values(defaults)
    .onConflictDoNothing({ target: expenseCategories.name })
    .returning({ id: expenseCategories.id })

  console.log(`✅ Expense categories ready (${inserted.length} added)`)
}

main().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
