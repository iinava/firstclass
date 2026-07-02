import { SignJWT, jwtVerify } from "jose"
import type { SessionPayload } from "@/types/auth"

const ALGORITHM = "HS256"
const SESSION_DURATION = "7d"

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set")
  return new TextEncoder().encode(secret)
}

/**
 * Signs a JWT with the session payload.
 * Fixed 7-day expiry — does not slide.
 */
export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey())
}

/**
 * Verifies and decodes a JWT.
 * Returns null if the token is invalid or expired.
 */
export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecretKey(), {
      algorithms: [ALGORITHM],
    })
    // payload is already typed as SessionPayload & JWTPayload by jose's generic
    return payload
  } catch {
    return null
  }
}
