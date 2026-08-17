import type { JWTPayload } from "jose"
import type { userRoleEnum } from "@/db/schemas/user.schema"

/**
 * Derived from the Drizzle enum so the two can never drift apart — adding a
 * role to the schema automatically widens this union and surfaces every place
 * (RBAC matrix, role labels) that needs updating as a type error.
 */
export type UserRole = (typeof userRoleEnum.enumValues)[number]

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
