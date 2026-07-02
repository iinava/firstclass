import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { encrypt, decrypt } from "@/lib/jwt"
import type { SessionPayload } from "@/types/auth"

const COOKIE_NAME = "session"
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days — fixed, not sliding

/**
 * Creates a session cookie after successful login.
 */
export async function createSession(data: SessionPayload): Promise<void> {
  const token = await encrypt(data)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  })
}

/**
 * Reads and decrypts the current session from the cookie.
 * Returns null if no session or invalid token.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return decrypt(token)
}

/**
 * Reads the session and redirects to /login if it is missing or invalid.
 * Use this in Server Components and layouts inside protected routes where
 * the middleware already guarantees a valid session — this just narrows the
 * type from SessionPayload | null to SessionPayload so callers need no
 * null checks or ?? fallbacks.
 */
export async function verifySession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}

/**
 * Deletes the session cookie (logout).
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
