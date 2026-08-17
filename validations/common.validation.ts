import { z } from "zod"

/** Indian mobile number — 10 digits, optionally +91 prefixed. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(\+?91)?[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number")

export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine(
    (v) => v === "" || /^(\+?91)?[6-9]\d{9}$/.test(v),
    "Enter a valid 10-digit mobile number"
  )
  .transform((v) => v || null)
  .nullable()
  .optional()

export const optionalEmailSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email")
  .transform((v) => v || null)
  .nullable()
  .optional()

/** Trims, and converts an empty string to null so the DB stores NULL not "". */
export const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => v || null)
    .nullable()
    .optional()

export const requiredText = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)

export const uuidSchema = z.uuid("Invalid identifier")

/** "YYYY-MM-DD" as stored in Postgres `date` columns. */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")

export const optionalDateString = z
  .string()
  .transform((v) => v || null)
  .nullable()
  .optional()
  .refine(
    (v) => v === null || v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
    "Enter a valid date"
  )

/**
 * Money arrives from forms as a rupee string ("12,500.50") and is stored as
 * integer paise. Rounding happens here so every entry point agrees.
 */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (typeof v === "number") return Math.round(v * 100)
    const cleaned = v.replace(/,/g, "").trim()
    if (cleaned === "") return 0
    const n = Number(cleaned)
    return Number.isFinite(n) ? Math.round(n * 100) : NaN
  })
  .refine((v) => Number.isFinite(v), "Enter a valid amount")
  .refine((v) => v >= 0, "Amount cannot be negative")

export const optionalMoneySchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null
    if (typeof v === "number") return Math.round(v * 100)
    const cleaned = String(v).replace(/,/g, "").trim()
    if (cleaned === "") return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? Math.round(n * 100) : NaN
  })
  .refine((v) => v === null || Number.isFinite(v), "Enter a valid amount")
  .refine((v) => v === null || v >= 0, "Amount cannot be negative")
  // Without this the key is required to be *present* even though the union
  // accepts undefined, so omitting an optional amount fails validation instead
  // of being treated as "not provided" — the same shape the other optional*
  // helpers already have.
  .optional()

/** Shared list/pagination params every table query accepts. */
export const listParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
})

export type ListParams = z.infer<typeof listParamsSchema>

/**
 * Reads list/filter params out of a query string without ever throwing.
 *
 * `schema.parse()` on `searchParams` takes the whole page down on any junk
 * value — a stale bookmark, a hand-edited URL, a filter that was renamed since
 * the link was shared — and the user gets an error boundary instead of a list.
 * A bad filter is not an exceptional condition on a public URL, so the invalid
 * keys are dropped and the schema's defaults apply.
 *
 * Only the offending keys are discarded, so one bad filter does not also throw
 * away the page number and search term the user still wants.
 */
export function safeListParams<S extends z.ZodType>(
  schema: S,
  raw: Record<string, unknown>
): z.output<S> {
  const first = schema.safeParse(raw)
  if (first.success) return first.data

  const cleaned = { ...raw }
  for (const issue of first.error.issues) {
    const key = issue.path[0]
    if (typeof key === "string") delete cleaned[key]
  }

  const second = schema.safeParse(cleaned)
  if (second.success) return second.data

  // Everything in these schemas is optional or defaulted, so an empty object
  // parses; the fallback is here so a future required field cannot reintroduce
  // the crash this function exists to prevent.
  const empty = schema.safeParse({})
  return empty.success ? empty.data : ({} as z.output<S>)
}

export interface PaginatedResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}
