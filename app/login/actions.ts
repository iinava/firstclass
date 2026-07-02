"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { users } from "@/db/schemas/user.schema"
import { createSession } from "@/lib/session"
import { verifyPassword } from "@/lib/password"
import type { LoginInput } from "@/validations/auth.validation"

export interface LoginActionResult {
  error?: string
}

/**
 * Server action that accepts pre-validated login data from the RHF form.
 * Zod validation is handled client-side by react-hook-form + zodResolver,
 * so this action only handles credential verification and session creation.
 */
export async function login(data: LoginInput): Promise<LoginActionResult> {
  const { username, password } = data

  // 1. Look up user by username
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) {
    // Same message for both cases — prevents user enumeration
    return { error: "Invalid username or password" }
  }

  // 2. Verify password
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return { error: "Invalid username or password" }
  }

  // 3. Create session
  await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    email: user.email ?? null,
  })

  // 4. Redirect to admin
  redirect("/admin")
}
