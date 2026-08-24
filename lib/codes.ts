import "server-only"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { counters } from "@/db/schemas/system.schema"

/**
 * Human-facing document numbers.
 *
 * Sequences live in the `counters` table and are bumped with a single
 * `UPDATE ... RETURNING`, which Postgres executes atomically on the row. That
 * makes it race-safe without an interactive transaction — important, because
 * the neon-http driver only supports non-interactive (batched) transactions.
 */

export type CounterKey =
  | "lead"
  | "quote"
  | "package"
  | "booking"
  | "invoice"
  | "receipt"
  | "supplier_payment"
  | "expense"
  | "employee"

/**
 * Indian financial year label for a date: 2026-08-15 -> "26-27" (Apr–Mar).
 * Invoice series legally reset each financial year.
 */
export function financialYear(date = new Date()): string {
  const year = date.getFullYear()
  const startYear = date.getMonth() >= 3 ? year : year - 1
  const two = (y: number) => String(y).slice(-2)
  return `${two(startYear)}-${two(startYear + 1)}`
}

/** Atomically claim the next value for a counter. */
async function nextValue(key: CounterKey, scope: string): Promise<number> {
  const [updated] = await db
    .update(counters)
    .set({ value: sql`${counters.value} + 1`, updatedAt: new Date() })
    .where(and(eq(counters.key, key), eq(counters.scope, scope)))
    .returning({ value: counters.value })

  if (updated) return updated.value

  // First use of this counter/scope. ON CONFLICT makes the insert idempotent if
  // two requests race here; the loser falls through to a second UPDATE.
  const [created] = await db
    .insert(counters)
    .values({ key, scope, value: 1 })
    .onConflictDoNothing({ target: [counters.key, counters.scope] })
    .returning({ value: counters.value })

  if (created) return created.value

  const [retried] = await db
    .update(counters)
    .set({ value: sql`${counters.value} + 1`, updatedAt: new Date() })
    .where(and(eq(counters.key, key), eq(counters.scope, scope)))
    .returning({ value: counters.value })

  if (!retried) {
    throw new Error(`Failed to allocate a number for counter "${key}"`)
  }
  return retried.value
}

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/** LEAD-000123 */
export async function nextLeadCode(): Promise<string> {
  return `LEAD-${pad(await nextValue("lead", "global"))}`
}

/** QUO-000123 — a custom itinerary sent to a customer. */
export async function nextQuoteCode(): Promise<string> {
  return `QUO-${pad(await nextValue("quote", "global"))}`
}

/** PKG-000123 — a reusable, publishable package. */
export async function nextPackageCode(): Promise<string> {
  return `PKG-${pad(await nextValue("package", "global"))}`
}

/** FC-26-27-000123 — bookings are scoped to the financial year. */
export async function nextBookingCode(date = new Date()): Promise<string> {
  const fy = financialYear(date)
  return `FC-${fy}-${pad(await nextValue("booking", fy))}`
}

/** FC/26-27/0001 — invoice series, resets every financial year. */
export async function nextInvoiceNumber(date = new Date()): Promise<string> {
  const fy = financialYear(date)
  return `FC/${fy}/${pad(await nextValue("invoice", fy), 4)}`
}

/** RCP/26-27/0001 */
export async function nextReceiptNumber(date = new Date()): Promise<string> {
  const fy = financialYear(date)
  return `RCP/${fy}/${pad(await nextValue("receipt", fy), 4)}`
}

/** PAY/26-27/0001 */
export async function nextSupplierPaymentNumber(date = new Date()): Promise<string> {
  const fy = financialYear(date)
  return `PAY/${fy}/${pad(await nextValue("supplier_payment", fy), 4)}`
}

/** EXP/26-27/0001 */
export async function nextExpenseNumber(date = new Date()): Promise<string> {
  const fy = financialYear(date)
  return `EXP/${fy}/${pad(await nextValue("expense", fy), 4)}`
}

/** EMP-0012 */
export async function nextEmployeeCode(): Promise<string> {
  return `EMP-${pad(await nextValue("employee", "global"), 4)}`
}

/**
 * Unguessable token for public itinerary share links. 32 hex chars — long
 * enough that enumeration is not a practical concern for an unlisted URL.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Every (re)generated share token gets 90 days before it stops resolving. */
export function shareTokenExpiry(): Date {
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
}
