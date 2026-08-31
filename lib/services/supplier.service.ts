import "server-only"
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import {
  supplierRates,
  suppliers,
  type Supplier,
  type SupplierRate,
} from "@/db/schemas/supplier.schema"
import { tripCostItems } from "@/db/schemas/trip-cost.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type { SupplierListParams } from "@/validations/supplier.validation"

const alive = isNull(suppliers.deletedAt)

const SORTABLE = {
  name: suppliers.name,
  type: suppliers.type,
  rating: suppliers.rating,
  createdAt: suppliers.createdAt,
} as const

export interface SupplierListRow extends Supplier {
  /** Lifetime spend, so ops can see who the business actually depends on. */
  totalSpend: number
  outstanding: number
  bookingCount: number
}

export async function listSuppliers(
  params: SupplierListParams
): Promise<PaginatedResult<SupplierListRow>> {
  const { page, pageSize, search, sortBy, sortDir, type, isActive } = params

  const filters = [alive]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(suppliers.name, term),
        ilike(suppliers.city, term),
        ilike(suppliers.contactPerson, term),
        ilike(suppliers.phone, term)
      )!
    )
  }
  if (type) filters.push(eq(suppliers.type, type))
  if (isActive) filters.push(eq(suppliers.isActive, isActive === "true"))

  const where = and(...filters)
  const column = SORTABLE[sortBy as keyof typeof SORTABLE] ?? suppliers.createdAt
  const order = sortDir === "asc" ? asc(column) : desc(column)

  const rowsPromise = db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      type: suppliers.type,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      altPhone: suppliers.altPhone,
      email: suppliers.email,
      address: suppliers.address,
      city: suppliers.city,
      state: suppliers.state,
      gstin: suppliers.gstin,
      paymentTerms: suppliers.paymentTerms,
      bankDetails: suppliers.bankDetails,
      rating: suppliers.rating,
      notes: suppliers.notes,
      isActive: suppliers.isActive,
      createdBy: suppliers.createdBy,
      createdAt: suppliers.createdAt,
      updatedAt: suppliers.updatedAt,
      deletedAt: suppliers.deletedAt,
      totalSpend: sql<number>`coalesce((
        select sum(${tripCostItems.costAmount}) from ${tripCostItems}
        where ${tripCostItems.supplierId} = "suppliers"."id"
          and ${tripCostItems.deletedAt} is null
          and ${tripCostItems.status} <> 'cancelled'
      ), 0)::bigint`,
      outstanding: sql<number>`coalesce((
        select sum(${tripCostItems.costAmount} - ${tripCostItems.paidAmount})
        from ${tripCostItems}
        where ${tripCostItems.supplierId} = "suppliers"."id"
          and ${tripCostItems.deletedAt} is null
          and ${tripCostItems.status} <> 'cancelled'
      ), 0)::bigint`,
      bookingCount: sql<number>`(
        select count(distinct ${tripCostItems.bookingId})::int from ${tripCostItems}
        where ${tripCostItems.supplierId} = "suppliers"."id"
          and ${tripCostItems.deletedAt} is null
      )`,
    })
    .from(suppliers)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db.select({ value: count() }).from(suppliers).where(where)
  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows.map((r) => ({
      ...r,
      totalSpend: Number(r.totalSpend),
      outstanding: Number(r.outstanding),
    })) as SupplierListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), alive))
    .limit(1)
  return row ?? null
}

/** Lightweight list for the supplier picker on trip cost lines and hotel selects. */
export async function getSupplierOptions(
  type?: Supplier["type"] | Supplier["type"][]
) {
  const typeFilter = Array.isArray(type)
    ? inArray(suppliers.type, type)
    : type
      ? eq(suppliers.type, type)
      : undefined

  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      type: suppliers.type,
      city: suppliers.city,
    })
    .from(suppliers)
    .where(and(alive, eq(suppliers.isActive, true), typeFilter))
    .orderBy(asc(suppliers.name))
    .limit(500)
}

export async function createSupplier(
  values: typeof suppliers.$inferInsert
): Promise<Supplier> {
  const [row] = await db.insert(suppliers).values(values).returning()
  return row
}

export async function updateSupplier(
  id: string,
  values: Partial<typeof suppliers.$inferInsert>
): Promise<Supplier | null> {
  const [row] = await db
    .update(suppliers)
    .set(values)
    .where(and(eq(suppliers.id, id), alive))
    .returning()
  return row ?? null
}

/**
 * Soft delete, refused when the supplier is referenced by trip costs — the
 * spend history behind every P&L report would otherwise point at nothing.
 */
export async function softDeleteSupplier(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ value: used }] = await db
    .select({ value: count() })
    .from(tripCostItems)
    .where(and(eq(tripCostItems.supplierId, id), isNull(tripCostItems.deletedAt)))

  if (used > 0) {
    return {
      ok: false,
      reason: `This supplier is used on ${used} trip cost line${used === 1 ? "" : "s"}. Mark it inactive instead.`,
    }
  }

  await db
    .update(suppliers)
    .set({ deletedAt: new Date() })
    .where(and(eq(suppliers.id, id), alive))
  return { ok: true }
}

// ---------------------------------------------------------------- rate cards

export async function listSupplierRates(supplierId: string): Promise<SupplierRate[]> {
  return db
    .select()
    .from(supplierRates)
    .where(eq(supplierRates.supplierId, supplierId))
    .orderBy(asc(supplierRates.title))
}

export async function createSupplierRate(
  values: typeof supplierRates.$inferInsert
): Promise<SupplierRate> {
  const [row] = await db.insert(supplierRates).values(values).returning()
  return row
}

export async function updateSupplierRate(
  id: string,
  values: Partial<typeof supplierRates.$inferInsert>
): Promise<SupplierRate | null> {
  const [row] = await db
    .update(supplierRates)
    .set(values)
    .where(eq(supplierRates.id, id))
    .returning()
  return row ?? null
}

export async function deleteSupplierRate(id: string): Promise<void> {
  await db.delete(supplierRates).where(eq(supplierRates.id, id))
}
