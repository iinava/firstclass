import type { JWTPayload } from "jose"

export type UserRole = "superadmin" | "admin" | "staff"

/**
 * Our application-level JWT claims, extending jose's standard JWTPayload.
 * This gives us iss, sub, exp, iat, jti, nbf, aud for free and ensures
 * structural compatibility with the object returned by jwtVerify().
 */
export interface SessionPayload extends JWTPayload {
  userId: string
  username: string
  role: UserRole
  email: string | null
}
