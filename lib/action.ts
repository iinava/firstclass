import "server-only"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"
import { getSession } from "@/lib/session"
import { hasPermission, type Permission } from "@/lib/rbac"
import type { SessionPayload } from "@/types/auth"

/**
 * Typed result returned by every server action.
 *
 * Actions never throw across the RSC boundary — an uncaught error there becomes
 * an opaque "An error occurred in the Server Components render" in production.
 * Instead they resolve to a discriminated union the client can branch on and
 * hand straight to a sonner toast.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data })
export const actionError = (
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<never> => ({ ok: false, error, fieldErrors })

/** Thrown inside actions to short-circuit with a user-safe message. */
export class ActionFailure extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message)
    this.name = "ActionFailure"
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message)
    this.name = "AuthorizationError"
  }
}

/** Postgres error shape we care about for friendly messages. */
interface PgError {
  code?: string
  constraint?: string
  detail?: string
}

/**
 * Digs the driver's error out of Drizzle's wrapper.
 *
 * Drizzle raises a `DrizzleQueryError` and hangs the real `NeonDbError` — the
 * one carrying `code` and `constraint` — off `cause`. Reading the fields
 * straight from the caught error finds nothing, so every constraint violation
 * would fall through to the generic "something went wrong".
 */
function pgErrorFrom(error: unknown): PgError | null {
  let current = error as { code?: unknown; cause?: unknown } | null | undefined
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current.code === "string") return current as PgError
    current = current.cause as typeof current
  }
  return null
}

function friendlyDbError(error: PgError): string | null {
  switch (error.code) {
    case "23505": // unique_violation
      if (error.constraint?.includes("phone"))
        return "A customer with this phone number already exists"
      if (error.constraint?.includes("username"))
        return "That username is already taken"
      if (error.constraint?.includes("reg_number"))
        return "A vehicle with this registration number already exists"
      if (error.constraint?.includes("emp_code"))
        return "That employee code is already in use"
      return "This record already exists"
    case "23503": // foreign_key_violation
      return "This record is linked to other data and cannot be changed"
    case "23514": // check_violation
      return "Some values are outside the allowed range"
    default:
      return null
  }
}

interface ActionContext {
  session: SessionPayload
}

interface ActionConfig<TInput, TOutput> {
  /** Zod schema the raw client input is validated against on the server. */
  schema?: z.ZodType<TInput>
  /** Permission required to run this action. Omit only for session-only checks. */
  permission?: Permission
  /** Human name used in error logs, e.g. "createLead". */
  name: string
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>
}

/**
 * Wraps a server action with session check, permission check, input validation,
 * and error normalisation.
 *
 * Validation runs on the server even though the client already validated with
 * the same schema — a server action is a public endpoint and client-side
 * validation is a UX affordance, not a security control.
 *
 * @example
 * export const createLead = defineAction({
 *   name: "createLead",
 *   permission: "lead:create",
 *   schema: CreateLeadSchema,
 *   handler: async (input, { session }) => { ... },
 * })
 */
export function defineAction<TInput, TOutput>({
  schema,
  permission,
  name,
  handler,
}: ActionConfig<TInput, TOutput>) {
  return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const session = await getSession()
      if (!session) {
        return actionError("Your session has expired. Please sign in again.")
      }

      if (permission && !hasPermission(session.role, permission)) {
        throw new AuthorizationError()
      }

      let input = rawInput
      if (schema) {
        const parsed = schema.safeParse(rawInput)
        if (!parsed.success) {
          const flat = z.flattenError(parsed.error)
          return actionError(
            "Please correct the highlighted fields",
            flat.fieldErrors as Record<string, string[]>
          )
        }
        input = parsed.data
      }

      const data = await handler(input, { session })
      return actionOk(data)
    } catch (error) {
      // redirect(), notFound() and friends work by throwing — let them through.
      unstable_rethrow(error)

      if (error instanceof ActionFailure) {
        return actionError(error.message, error.fieldErrors)
      }
      if (error instanceof AuthorizationError) {
        return actionError(error.message)
      }

      const pgError = pgErrorFrom(error)
      const dbMessage = pgError ? friendlyDbError(pgError) : null
      if (dbMessage) {
        console.error(`[action:${name}] db constraint`, error)
        return actionError(dbMessage)
      }

      console.error(`[action:${name}] unhandled`, error)
      return actionError("Something went wrong. Please try again.")
    }
  }
}

/**
 * Guard for Server Components and data loaders (not actions). Throws rather
 * than returning a result, so a forbidden page renders the error boundary.
 */
export async function requirePermission(
  permission: Permission
): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new AuthorizationError("Not signed in")
  if (!hasPermission(session.role, permission)) throw new AuthorizationError()
  return session
}
