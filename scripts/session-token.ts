/**
 * Prints a session cookie value for an existing user — `tsx scripts/session-token.ts [username]`.
 *
 * Used by the self-test harness to call server actions as a real signed-in
 * user without going through the login form. Development only.
 */
import { eq } from "drizzle-orm"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { users } from "../db/schemas/user.schema"
import { encrypt } from "../lib/jwt"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle({ client: sql })

async function main() {
  const username = process.argv[2] ?? process.env.SEED_ADMIN_USERNAME ?? "admin"

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) {
    console.error(`No user "${username}"`)
    process.exit(1)
  }

  process.stdout.write(
    await encrypt({
      userId: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
    })
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
