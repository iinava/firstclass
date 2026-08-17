import "server-only"
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { customers, type Customer } from "@/db/schemas/customer.schema"
import { bookings } from "@/db/schemas/booking.schema"
import { leads } from "@/db/schemas/lead.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type {
  CreateCustomerInput,
  CustomerListParams,
  UpdateCustomerInput,
} from "@/validations/customer.validation"

const SORTABLE = {
  name: customers.name,
  city: customers.city,
  createdAt: customers.createdAt,
} as const

/** Only ever look at rows that haven't been soft-deleted. */
const alive = isNull(customers.deletedAt)

export interface CustomerListRow extends Customer {
  leadCount: number
  bookingCount: number
}

export async function listCustomers(
  params: CustomerListParams
): Promise<PaginatedResult<CustomerListRow>> {
  const { page, pageSize, search, sortBy, sortDir, source, city } = params

  const filters = [alive]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(customers.name, term),
        ilike(customers.phone, term),
        ilike(customers.email, term),
        ilike(customers.city, term)
      )!
    )
  }
  if (source) filters.push(eq(customers.source, source))
  if (city) filters.push(ilike(customers.city, `%${city}%`))

  const where = and(...filters)
  const column = SORTABLE[sortBy as keyof typeof SORTABLE] ?? customers.createdAt
  const order = sortDir === "asc" ? asc(column) : desc(column)

  // Correlated subqueries keep this to a single round trip — important on
  // neon-http where every query is a separate HTTP request.
  const rowsPromise = db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      altPhone: customers.altPhone,
      email: customers.email,
      address: customers.address,
      city: customers.city,
      state: customers.state,
      pincode: customers.pincode,
      source: customers.source,
      gstin: customers.gstin,
      notes: customers.notes,
      createdBy: customers.createdBy,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      deletedAt: customers.deletedAt,
      leadCount: sql<number>`(
        select count(*)::int from ${leads}
        where ${leads.customerId} = "customers"."id" and ${leads.deletedAt} is null
      )`,
      bookingCount: sql<number>`(
        select count(*)::int from ${bookings}
        where ${bookings.customerId} = "customers"."id" and ${bookings.deletedAt} is null
      )`,
    })
    .from(customers)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db.select({ value: count() }).from(customers).where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), alive))
    .limit(1)
  return row ?? null
}

/** Phone is the identity key — a repeat caller must resolve to one record. */
export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.phone, phone), alive))
    .limit(1)
  return row ?? null
}

/** Typeahead for the "pick a customer" combobox. */
export async function searchCustomers(term: string, limit = 10) {
  if (!term.trim()) return []
  const pattern = `%${term.trim()}%`
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      city: customers.city,
    })
    .from(customers)
    .where(and(alive, or(ilike(customers.name, pattern), ilike(customers.phone, pattern))))
    .orderBy(asc(customers.name))
    .limit(limit)
}

export async function createCustomer(
  input: CreateCustomerInput,
  userId: string
): Promise<Customer> {
  const [row] = await db
    .insert(customers)
    .values({ ...input, createdBy: userId })
    .returning()
  return row
}

/**
 * Find an existing customer by phone or create one. Used by the lead form so
 * staff never have to decide whether the caller is already in the system.
 */
export async function upsertCustomerByPhone(
  input: { name: string; phone: string; source?: Customer["source"] },
  userId: string
): Promise<{ customer: Customer; created: boolean }> {
  const existing = await findCustomerByPhone(input.phone)
  if (existing) return { customer: existing, created: false }

  const [row] = await db
    .insert(customers)
    .values({
      name: input.name,
      phone: input.phone,
      source: input.source ?? "walk_in",
      createdBy: userId,
    })
    // Guards the race where two staff add the same caller simultaneously.
    .onConflictDoNothing({ target: customers.phone })
    .returning()

  if (row) return { customer: row, created: true }

  const raced = await findCustomerByPhone(input.phone)
  if (!raced) throw new Error("Failed to create customer")
  return { customer: raced, created: false }
}

export async function updateCustomer(
  { id, ...values }: UpdateCustomerInput
): Promise<Customer | null> {
  const [row] = await db
    .update(customers)
    .set(values)
    .where(and(eq(customers.id, id), alive))
    .returning()
  return row ?? null
}

/**
 * Soft delete. Refuses when the customer has history — deleting someone with
 * bookings would orphan invoices and silently corrupt the revenue reports.
 */
export async function softDeleteCustomer(id: string): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const [{ value: bookingCount }] = await db
    .select({ value: count() })
    .from(bookings)
    .where(and(eq(bookings.customerId, id), isNull(bookings.deletedAt)))

  if (bookingCount > 0) {
    return {
      ok: false,
      reason: `This customer has ${bookingCount} booking${bookingCount === 1 ? "" : "s"} and cannot be deleted`,
    }
  }

  await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.id, id), alive))

  return { ok: true }
}
