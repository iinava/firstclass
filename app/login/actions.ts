"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { users } from "@/db/schemas/user.schema"
import { createSession } from "@/lib/session"
import { verifyPassword } from "@/lib/password"
import { touchLastLogin } from "@/lib/services/user.service"
import { LoginSchema, type LoginInput } from "@/validations/auth.validation"

export interface LoginActionResult {
  error?: string
}

/**
 * Server action backing the login form.
 *
 * Like every other server action this is a public HTTP endpoint anyone can
 * POST to directly, so — unlike a plain defineAction handler which already
 * validates centrally — this one re-validates with LoginSchema itself, since
 * it runs before a session exists and can't go through that wrapper.
 */
export async function login(data: LoginInput): Promise<LoginActionResult> {
  try {
    const parsed = LoginSchema.safeParse(data)
    if (!parsed.success) {
      return { error: "Invalid username or password" }
    }
    const { username, password } = parsed.data

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

    // 3. Deactivated accounts must not be able to sign in — checked after the
    //    password so a wrong password can't be used to probe which accounts exist.
    if (!user.isActive) {
      return { error: "This account has been deactivated. Contact an administrator." }
    }

    // 4. Create session
    await createSession({
      userId: user.id,
      username: user.username,
      role: user.role,
      email: user.email ?? null,
    })

    // Recorded for the Users screen; a failure here must not block sign-in.
    await touchLastLogin(user.id).catch(() => {})
  } catch (error) {
    console.error("[action:login] unhandled", error)
    return { error: "Something went wrong. Please try again." }
  }

  // 5. Redirect to admin (outside the try/catch — redirect() itself throws)
  redirect("/admin")
}
