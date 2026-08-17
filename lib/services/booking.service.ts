import "server-only"
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { bookingPax, bookings, type Booking } from "@/db/schemas/booking.schema"
import { customers } from "@/db/schemas/customer.schema"
import { expenses, receipts } from "@/db/schemas/accounts.schema"
import { suppliers } from "@/db/schemas/supplier.schema"
import { tripCostItems, type TripCostItem } from "@/db/schemas/trip-cost.schema"
import { users } from "@/db/schemas/user.schema"
import { vehicles } from "@/db/schemas/vehicle.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type { BookingListParams } from "@/validations/booking.validation"

const alive = isNull(bookings.deletedAt)

const SORTABLE = {
  code: bookings.code,
  startDate: bookings.startDate,
  grandTotal: bookings.grandTotal,
  status: bookings.status,
  createdAt: bookings.createdAt,
} as const

export interface BookingListRow {
  id: string
  code: string
  title: string
  destination: string | null
  startDate: string
  endDate: string
  adults: number
  children: number
  infants: number
  status: Booking["status"]
  grandTotal: number
  customerId: string
  customerName: string
  customerPhone: string
  assigneeName: string | null
  /** Live money position, computed rather than stored so it can never drift. */
  received: number
  balance: number
  costTotal: number
  profit: number
}

const listSelection = {
  id: bookings.id,
  code: bookings.code,
  title: bookings.title,
  destination: bookings.destination,
  startDate: bookings.startDate,
  endDate: bookings.endDate,
  adults: bookings.adults,
  children: bookings.children,
  infants: bookings.infants,
  status: bookings.status,
  grandTotal: bookings.grandTotal,
  customerId: bookings.customerId,
  customerName: customers.name,
  customerPhone: customers.phone,
  assigneeName: sql<string | null>`coalesce(${users.name}, ${users.username})`,
  received: sql<number>`coalesce((
    select sum(${receipts.amount}) from ${receipts}
    where ${receipts.bookingId} = "bookings"."id" and ${receipts.voidedAt} is null
  ), 0)::bigint`,
  costTotal: sql<number>`coalesce((
    select sum(${tripCostItems.costAmount}) from ${tripCostItems}
    where ${tripCostItems.bookingId} = "bookings"."id"
      and ${tripCostItems.deletedAt} is null
      and ${tripCostItems.status} <> 'cancelled'
  ), 0)::bigint + coalesce((
    select sum(${expenses.amount}) from ${expenses}
    where ${expenses.bookingId} = "bookings"."id" and ${expenses.deletedAt} is null
  ), 0)::bigint`,
}

function decorate(row: Record<string, unknown>): BookingListRow {
  const grandTotal = Number(row.grandTotal ?? 0)
  const received = Number(row.received ?? 0)
  const costTotal = Number(row.costTotal ?? 0)
  return {
    ...(row as unknown as BookingListRow),
    grandTotal,
    received,
    costTotal,
    balance: grandTotal - received,
    profit: grandTotal - costTotal,
  }
}

export async function listBookings(
  params: BookingListParams,
  restrictToUserId?: string | null
): Promise<PaginatedResult<BookingListRow>> {
  const { page, pageSize, search, sortBy, sortDir, status, customerId, assignedTo, from, to } =
    params

  const filters = [alive]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(bookings.code, term),
        ilike(bookings.title, term),
        ilike(bookings.destination, term),
        ilike(customers.name, term),
        ilike(customers.phone, term)
      )!
    )
  }
  if (status) filters.push(eq(bookings.status, status))
  if (customerId) filters.push(eq(bookings.customerId, customerId))
  if (assignedTo) filters.push(eq(bookings.assignedTo, assignedTo))
  if (from) filters.push(gte(bookings.startDate, from))
  if (to) filters.push(lte(bookings.startDate, to))
  if (restrictToUserId) filters.push(eq(bookings.assignedTo, restrictToUserId))

  const where = and(...filters)
  const column = SORTABLE[sortBy as keyof typeof SORTABLE] ?? bookings.startDate
  const order = sortDir === "asc" ? asc(column) : desc(column)

  const rowsPromise = db
    .select(listSelection)
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .leftJoin(users, eq(users.id, bookings.assignedTo))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db
    .select({ value: count() })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows.map(decorate),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getBooking(id: string): Promise<BookingListRow | null> {
  const [row] = await db
    .select(listSelection)
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .leftJoin(users, eq(users.id, bookings.assignedTo))
    .where(and(eq(bookings.id, id), alive))
    .limit(1)
  return row ? decorate(row) : null
}

export async function getBookingRaw(id: string): Promise<Booking | null> {
  const [row] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), alive))
    .limit(1)
  return row ?? null
}

export async function getBookingOptions(search?: string) {
  return db
    .select({
      id: bookings.id,
      code: bookings.code,
      title: bookings.title,
      customerName: customers.name,
      grandTotal: bookings.grandTotal,
      startDate: bookings.startDate,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(
      and(
        alive,
        search
          ? or(ilike(bookings.code, `%${search}%`), ilike(customers.name, `%${search}%`))
          : undefined
      )
    )
    .orderBy(desc(bookings.startDate))
    .limit(100)
}

export async function createBooking(
  values: typeof bookings.$inferInsert
): Promise<Booking> {
  const [row] = await db.insert(bookings).values(values).returning()
  return row
}

export async function updateBooking(
  id: string,
  values: Partial<typeof bookings.$inferInsert>
): Promise<Booking | null> {
  const [row] = await db
    .update(bookings)
    .set(values)
    .where(and(eq(bookings.id, id), alive))
    .returning()
  return row ?? null
}

export async function softDeleteBooking(id: string): Promise<void> {
  await db
    .update(bookings)
    .set({ deletedAt: new Date() })
    .where(and(eq(bookings.id, id), alive))
}

// ------------------------------------------------------------------ costing

export interface TripCostRow extends TripCostItem {
  supplierName: string | null
  vehicleReg: string | null
}

export async function listTripCosts(bookingId: string): Promise<TripCostRow[]> {
  const rows = await db
    .select({
      id: tripCostItems.id,
      bookingId: tripCostItems.bookingId,
      category: tripCostItems.category,
      supplierId: tripCostItems.supplierId,
      vehicleId: tripCostItems.vehicleId,
      description: tripCostItems.description,
      serviceDate: tripCostItems.serviceDate,
      quantity: tripCostItems.quantity,
      unitCost: tripCostItems.unitCost,
      costAmount: tripCostItems.costAmount,
      sellAmount: tripCostItems.sellAmount,
      status: tripCostItems.status,
      paymentStatus: tripCostItems.paymentStatus,
      paidAmount: tripCostItems.paidAmount,
      confirmationNo: tripCostItems.confirmationNo,
      notes: tripCostItems.notes,
      createdBy: tripCostItems.createdBy,
      createdAt: tripCostItems.createdAt,
      updatedAt: tripCostItems.updatedAt,
      deletedAt: tripCostItems.deletedAt,
      supplierName: suppliers.name,
      vehicleReg: vehicles.regNumber,
    })
    .from(tripCostItems)
    .leftJoin(suppliers, eq(suppliers.id, tripCostItems.supplierId))
    .leftJoin(vehicles, eq(vehicles.id, tripCostItems.vehicleId))
    .where(and(eq(tripCostItems.bookingId, bookingId), isNull(tripCostItems.deletedAt)))
    .orderBy(asc(tripCostItems.serviceDate), asc(tripCostItems.createdAt))

  return rows as TripCostRow[]
}

export async function createTripCost(
  values: typeof tripCostItems.$inferInsert
): Promise<TripCostItem> {
  const [row] = await db.insert(tripCostItems).values(values).returning()
  return row
}

export async function updateTripCost(
  id: string,
  values: Partial<typeof tripCostItems.$inferInsert>
): Promise<TripCostItem | null> {
  const [row] = await db
    .update(tripCostItems)
    .set(values)
    .where(and(eq(tripCostItems.id, id), isNull(tripCostItems.deletedAt)))
    .returning()
  return row ?? null
}

export async function getTripCost(id: string): Promise<TripCostItem | null> {
  const [row] = await db
    .select()
    .from(tripCostItems)
    .where(and(eq(tripCostItems.id, id), isNull(tripCostItems.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function softDeleteTripCost(id: string): Promise<void> {
  await db
    .update(tripCostItems)
    .set({ deletedAt: new Date() })
    .where(eq(tripCostItems.id, id))
}

/** The per-trip P&L panel: revenue, cost by category, received, balance. */
export async function getBookingLedger(bookingId: string) {
  const [costByCategory, [totals], [receiptRow]] = await Promise.all([
    db
      .select({
        category: tripCostItems.category,
        cost: sql<number>`coalesce(sum(${tripCostItems.costAmount}), 0)::bigint`,
        sell: sql<number>`coalesce(sum(${tripCostItems.sellAmount}), 0)::bigint`,
      })
      .from(tripCostItems)
      .where(
        and(
          eq(tripCostItems.bookingId, bookingId),
          isNull(tripCostItems.deletedAt),
          sql`${tripCostItems.status} <> 'cancelled'`
        )
      )
      .groupBy(tripCostItems.category),

    db
      .select({
        costTotal: sql<number>`coalesce(sum(${tripCostItems.costAmount}), 0)::bigint`,
        paidToSuppliers: sql<number>`coalesce(sum(${tripCostItems.paidAmount}), 0)::bigint`,
      })
      .from(tripCostItems)
      .where(
        and(
          eq(tripCostItems.bookingId, bookingId),
          isNull(tripCostItems.deletedAt),
          sql`${tripCostItems.status} <> 'cancelled'`
        )
      ),

    db
      .select({
        received: sql<number>`coalesce(sum(${receipts.amount}), 0)::bigint`,
        advance: sql<number>`coalesce(sum(${receipts.amount}) filter (where ${receipts.isAdvance}), 0)::bigint`,
      })
      .from(receipts)
      .where(and(eq(receipts.bookingId, bookingId), isNull(receipts.voidedAt))),
  ])

  const [expenseRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint`,
    })
    .from(expenses)
    .where(and(eq(expenses.bookingId, bookingId), isNull(expenses.deletedAt)))

  const booking = await getBookingRaw(bookingId)
  const revenue = Number(booking?.grandTotal ?? 0)
  const supplierCost = Number(totals?.costTotal ?? 0)
  const directExpense = Number(expenseRow?.total ?? 0)
  const cost = supplierCost + directExpense
  const received = Number(receiptRow?.received ?? 0)

  return {
    revenue,
    supplierCost,
    directExpense,
    cost,
    profit: revenue - cost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    received,
    advance: Number(receiptRow?.advance ?? 0),
    balance: revenue - received,
    paidToSuppliers: Number(totals?.paidToSuppliers ?? 0),
    supplierOutstanding: supplierCost - Number(totals?.paidToSuppliers ?? 0),
    costByCategory: costByCategory.map((r) => ({
      category: r.category,
      cost: Number(r.cost),
      sell: Number(r.sell),
    })),
  }
}

// ------------------------------------------------------------------ pax list

export async function listPax(bookingId: string) {
  return db
    .select()
    .from(bookingPax)
    .where(eq(bookingPax.bookingId, bookingId))
    .orderBy(asc(bookingPax.createdAt))
}

export async function createPax(values: typeof bookingPax.$inferInsert) {
  const [row] = await db.insert(bookingPax).values(values).returning()
  return row
}

export async function deletePax(id: string): Promise<void> {
  await db.delete(bookingPax).where(eq(bookingPax.id, id))
}
