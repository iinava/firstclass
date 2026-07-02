"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { users } from "@/db/schemas/user.schema"
import { createSession } from "@/lib/session"
import { verifyPassword } from "@/lib/password"
import { LoginSchema } from "@/validations/auth.validation"
import type { AuthFormState } from "@/types/auth"

export async function login(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  // 1. Validate fields with Zod
  const validated = LoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { username, password } = validated.data

  // 2. Look up user by username
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) {
    // Same message for both "user not found" and "wrong password" — prevents enumeration
    return { message: "Invalid username or password" }
  }

  // 3. Verify password
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return { message: "Invalid username or password" }
  }

  // 4. Create session
  await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    email: user.email ?? null,
  })

  // 5. Redirect to admin
  redirect("/admin")
}
