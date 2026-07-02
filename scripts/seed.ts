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
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
