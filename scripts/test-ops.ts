/**
 * Runs the end-to-end operations harness — `pnpm test:ops`.
 *
 * Server actions only exist inside a request, so the suite itself lives at
 * `/api/selftest` and this script just drives it: mint a session for the seeded
 * admin, call the route, print the result. The dev server must already be
 * running (`pnpm dev`).
 *
 *   pnpm test:ops                  # every module
 *   pnpm test:ops bookings         # one section
 */
import { eq } from "drizzle-orm"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { users } from "../db/schemas/user.schema"
import { encrypt } from "../lib/jwt"

interface Row {
  name: string
  ok: boolean
  detail?: string
}

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"

async function main() {
  const section = process.argv[2]
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin"

  const db = drizzle({ client: neon(process.env.DATABASE_URL!) })
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) {
    console.error(`No user "${username}" — run \`pnpm db:seed\` first.`)
    process.exit(1)
  }

  const token = await encrypt({
    userId: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
  })

  const url = `${BASE}/api/selftest${section ? `?only=${section}` : ""}`
  let response: Response
  try {
    response = await fetch(url, { headers: { cookie: `session=${token}` } })
  } catch {
    console.error(`Could not reach ${BASE} — is \`pnpm dev\` running?`)
    process.exit(1)
  }

  const body = (await response.json()) as {
    passed: number
    failed: number
    results: Row[]
  }

  for (const row of body.results) {
    if (row.name.startsWith("—")) console.log(`\n${row.name}`)
    else if (row.ok) console.log(`  PASS  ${row.name}`)
    else console.log(`  FAIL  ${row.name}${row.detail ? ` — ${row.detail}` : ""}`)
  }

  console.log(`\n${body.passed} passed, ${body.failed} failed\n`)
  // exitCode rather than exit() so the HTTP agent unwinds cleanly on Windows.
  if (body.failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
