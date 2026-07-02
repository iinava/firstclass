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

/** Field-level error bag for the login form, used with useActionState. */
export interface AuthFormErrors {
  username?: string[]
  password?: string[]
}

/**
 * Return type of the login Server Action.
 * undefined = initial / not yet submitted.
 */
export type AuthFormState =
  | {
      errors?: AuthFormErrors
      message?: string
    }
  | undefined
