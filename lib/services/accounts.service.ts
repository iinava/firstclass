import "server-only"
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import {
  expenseCategories,
  expenses,
  invoiceLines,
  invoices,
  receipts,
  supplierPayments,
  type Expense,
  type Invoice,
} from "@/db/schemas/accounts.schema"
import { bookings } from "@/db/schemas/booking.schema"
import { customers } from "@/db/schemas/customer.schema"
import { suppliers } from "@/db/schemas/supplier.schema"
import { tripCostItems } from "@/db/schemas/trip-cost.schema"
import { vehicles } from "@/db/schemas/vehicle.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type {
  ExpenseListParams,
  InvoiceListParams,
  ReceiptListParams,
} from "@/validations/accounts.validation"

// ------------------------------------------------------------------ invoices

export interface InvoiceListRow {
  id: string
  number: string
  status: Invoice["status"]
  issueDate: string
  dueDate: string | null
  total: number
  amountPaid: number
  balance: number
  bookingId: string
  bookingCode: string
  customerId: string
  customerName: string
}

export async function listInvoices(
  params: InvoiceListParams
): Promise<PaginatedResult<InvoiceListRow>> {
  const { page, pageSize, search, sortDir, status, customerId, from, to } = params

  const filters = [isNull(invoices.deletedAt)]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(ilike(invoices.number, term), ilike(customers.name, term), ilike(bookings.code, term))!
    )
  }
  if (status) filters.push(eq(invoices.status, status))
  if (customerId) filters.push(eq(invoices.customerId, customerId))
  if (from) filters.push(gte(invoices.issueDate, from))
  if (to) filters.push(lte(invoices.issueDate, to))

  const where = and(...filters)
  const order = sortDir === "asc" ? asc(invoices.issueDate) : desc(invoices.issueDate)

  const rowsPromise = db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      bookingId: invoices.bookingId,
      bookingCode: bookings.code,
      customerId: invoices.customerId,
      customerName: customers.name,
    })
    .from(invoices)
    .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db
    .select({ value: count() })
    .from(invoices)
    .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows.map((r) => ({
      ...r,
      total: Number(r.total),
      amountPaid: Number(r.amountPaid),
      balance: Number(r.total) - Number(r.amountPaid),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getInvoice(id: string) {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function getInvoiceByBooking(bookingId: string) {
  const [row] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.bookingId, bookingId),
        isNull(invoices.deletedAt),
        sql`${invoices.status} <> 'cancelled'`
      )
    )
    .limit(1)
  return row ?? null
}

export async function createInvoice(
  values: typeof invoices.$inferInsert,
  lines: Omit<typeof invoiceLines.$inferInsert, "invoiceId">[]
) {
  const [invoice] = await db.insert(invoices).values(values).returning()
  if (lines.length > 0) {
    await db
      .insert(invoiceLines)
      .values(lines.map((line) => ({ ...line, invoiceId: invoice.id })))
  }
  return invoice
}

export async function listInvoiceLines(invoiceId: string) {
  return db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(asc(invoiceLines.sortOrder))
}

export async function updateInvoice(
  id: string,
  values: Partial<typeof invoices.$inferInsert>
) {
  const [row] = await db
    .update(invoices)
    .set(values)
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .returning()
  return row ?? null
}

// ------------------------------------------------------------------ receipts

export interface ReceiptListRow {
  id: string
  number: string
  amount: number
  mode: string
  reference: string | null
  receivedAt: string
  isAdvance: boolean
  voidedAt: Date | null
  bookingId: string
  bookingCode: string
  customerName: string
}

export async function listReceipts(
  params: ReceiptListParams
): Promise<PaginatedResult<ReceiptListRow>> {
  const { page, pageSize, search, sortDir, mode, bookingId, from, to } = params

  const filters = []
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(receipts.number, term),
        ilike(customers.name, term),
        ilike(bookings.code, term),
        ilike(receipts.reference, term)
      )!
    )
  }
  if (mode) filters.push(eq(receipts.mode, mode))
  if (bookingId) filters.push(eq(receipts.bookingId, bookingId))
  if (from) filters.push(gte(receipts.receivedAt, from))
  if (to) filters.push(lte(receipts.receivedAt, to))

  const where = filters.length ? and(...filters) : undefined
  const order = sortDir === "asc" ? asc(receipts.receivedAt) : desc(receipts.receivedAt)

  const rowsPromise = db
    .select({
      id: receipts.id,
      number: receipts.number,
      amount: receipts.amount,
      mode: receipts.mode,
      reference: receipts.reference,
      receivedAt: receipts.receivedAt,
      isAdvance: receipts.isAdvance,
      voidedAt: receipts.voidedAt,
      bookingId: receipts.bookingId,
      bookingCode: bookings.code,
      customerName: customers.name,
    })
    .from(receipts)
    .innerJoin(bookings, eq(bookings.id, receipts.bookingId))
    .innerJoin(customers, eq(customers.id, receipts.customerId))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db
    .select({ value: count() })
    .from(receipts)
    .innerJoin(bookings, eq(bookings.id, receipts.bookingId))
    .innerJoin(customers, eq(customers.id, receipts.customerId))
    .where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows.map((r) => ({ ...r, amount: Number(r.amount) })) as ReceiptListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getReceipt(id: string) {
  const [row] = await db.select().from(receipts).where(eq(receipts.id, id)).limit(1)
  return row ?? null
}

export async function createReceipt(values: typeof receipts.$inferInsert) {
  const [row] = await db.insert(receipts).values(values).returning()
  return row
}

/**
 * Applies a receipt to its invoice.
 *
 * `amount_paid = amount_paid + $delta` is computed in SQL rather than read into
 * JS and written back — with the neon-http driver there is no interactive
 * transaction to protect a read-modify-write, so the increment has to be atomic
 * on its own.
 */
export async function applyReceiptToInvoice(
  invoiceId: string,
  delta: number
): Promise<void> {
  await db
    .update(invoices)
    .set({
      amountPaid: sql`${invoices.amountPaid} + ${delta}`,
      status: sql`case
        when ${invoices.amountPaid} + ${delta} >= ${invoices.total} then 'paid'::invoice_status
        when ${invoices.amountPaid} + ${delta} > 0 then 'partially_paid'::invoice_status
        else ${invoices.status}
      end`,
    })
    .where(eq(invoices.id, invoiceId))
}

export async function voidReceipt(id: string, reason: string) {
  const [row] = await db
    .update(receipts)
    .set({ voidedAt: new Date(), voidReason: reason })
    .where(and(eq(receipts.id, id), isNull(receipts.voidedAt)))
    .returning()
  return row ?? null
}

export async function listReceiptsByBooking(bookingId: string) {
  return db
    .select()
    .from(receipts)
    .where(eq(receipts.bookingId, bookingId))
    .orderBy(desc(receipts.receivedAt))
}

// --------------------------------------------------------- supplier payments

export async function createSupplierPayment(
  values: typeof supplierPayments.$inferInsert
) {
  const [row] = await db.insert(supplierPayments).values(values).returning()
  return row
}

/** Mirrors applyReceiptToInvoice for the payables side. */
export async function applyPaymentToCostItem(
  tripCostItemId: string,
  delta: number
): Promise<void> {
  await db
    .update(tripCostItems)
    .set({
      paidAmount: sql`${tripCostItems.paidAmount} + ${delta}`,
      paymentStatus: sql`case
        when ${tripCostItems.paidAmount} + ${delta} >= ${tripCostItems.costAmount} then 'paid'::payable_status
        when ${tripCostItems.paidAmount} + ${delta} > 0 then 'partial'::payable_status
        else 'unpaid'::payable_status
      end`,
    })
    .where(eq(tripCostItems.id, tripCostItemId))
}

export async function listSupplierPayments(params: ReceiptListParams) {
  const { page, pageSize, search, from, to } = params
  const filters = []
  if (search) {
    filters.push(
      or(ilike(supplierPayments.number, `%${search}%`), ilike(suppliers.name, `%${search}%`))!
    )
  }
  if (from) filters.push(gte(supplierPayments.paidAt, from))
  if (to) filters.push(lte(supplierPayments.paidAt, to))
  const where = filters.length ? and(...filters) : undefined

  const rowsPromise = db
    .select({
      id: supplierPayments.id,
      number: supplierPayments.number,
      amount: supplierPayments.amount,
      mode: supplierPayments.mode,
      reference: supplierPayments.reference,
      paidAt: supplierPayments.paidAt,
      voidedAt: supplierPayments.voidedAt,
      supplierId: supplierPayments.supplierId,
      supplierName: suppliers.name,
      bookingId: supplierPayments.bookingId,
      bookingCode: bookings.code,
    })
    .from(supplierPayments)
    .innerJoin(suppliers, eq(suppliers.id, supplierPayments.supplierId))
    .leftJoin(bookings, eq(bookings.id, supplierPayments.bookingId))
    .where(where)
    .orderBy(desc(supplierPayments.paidAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db
    .select({ value: count() })
    .from(supplierPayments)
    .innerJoin(suppliers, eq(suppliers.id, supplierPayments.supplierId))
    .where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

// ------------------------------------------------------------------ expenses

export interface ExpenseListRow extends Expense {
  categoryName: string | null
  bookingCode: string | null
  vehicleReg: string | null
}

/** Adds the summed amount for the current filter — the tile above the table. */
export type ExpenseListResult = PaginatedResult<ExpenseListRow> & {
  filteredTotal: number
}

export async function listExpenses(
  params: ExpenseListParams
): Promise<ExpenseListResult> {
  const { page, pageSize, search, sortDir, categoryId, bookingId, vehicleId, from, to } =
    params

  const filters = [isNull(expenses.deletedAt)]
  if (search) filters.push(ilike(expenses.description, `%${search}%`))
  if (categoryId) filters.push(eq(expenses.categoryId, categoryId))
  if (bookingId) filters.push(eq(expenses.bookingId, bookingId))
  if (vehicleId) filters.push(eq(expenses.vehicleId, vehicleId))
  if (from) filters.push(gte(expenses.spentAt, from))
  if (to) filters.push(lte(expenses.spentAt, to))

  const where = and(...filters)
  const order = sortDir === "asc" ? asc(expenses.spentAt) : desc(expenses.spentAt)

  const rowsPromise = db
    .select({
      id: expenses.id,
      number: expenses.number,
      bookingId: expenses.bookingId,
      vehicleId: expenses.vehicleId,
      categoryId: expenses.categoryId,
      description: expenses.description,
      amount: expenses.amount,
      spentAt: expenses.spentAt,
      mode: expenses.mode,
      billUrl: expenses.billUrl,
      approvedBy: expenses.approvedBy,
      approvedAt: expenses.approvedAt,
      notes: expenses.notes,
      createdBy: expenses.createdBy,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
      deletedAt: expenses.deletedAt,
      categoryName: expenseCategories.name,
      bookingCode: bookings.code,
      vehicleReg: vehicles.regNumber,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .leftJoin(bookings, eq(bookings.id, expenses.bookingId))
    .leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db.select({ value: count() }).from(expenses).where(where)
  const sumPromise = db
    .select({ value: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
    .from(expenses)
    .where(where)

  const [rows, [{ value: total }], [{ value: sum }]] = await Promise.all([
    rowsPromise,
    totalPromise,
    sumPromise,
  ])

  return {
    rows: rows.map((r) => ({ ...r, amount: Number(r.amount) })) as ExpenseListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    filteredTotal: Number(sum),
  }
}

export async function getExpense(id: string) {
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function createExpense(values: typeof expenses.$inferInsert) {
  const [row] = await db.insert(expenses).values(values).returning()
  return row
}

export async function updateExpense(
  id: string,
  values: Partial<typeof expenses.$inferInsert>
) {
  const [row] = await db
    .update(expenses)
    .set(values)
    .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
    .returning()
  return row ?? null
}

export async function softDeleteExpense(id: string): Promise<void> {
  await db.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, id))
}

export async function listExpenseCategories() {
  return db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.isActive, true))
    .orderBy(asc(expenseCategories.name))
}

export async function createExpenseCategory(
  values: typeof expenseCategories.$inferInsert
) {
  const [row] = await db.insert(expenseCategories).values(values).returning()
  return row
}

/** Money owed to the business, oldest first — the collections worklist. */
export async function getOutstanding() {
  return db
    .select({
      bookingId: bookings.id,
      code: bookings.code,
      title: bookings.title,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      status: bookings.status,
      customerName: customers.name,
      customerPhone: customers.phone,
      grandTotal: bookings.grandTotal,
      received: sql<number>`coalesce((
        select sum(${receipts.amount}) from ${receipts}
        where ${receipts.bookingId} = "bookings"."id" and ${receipts.voidedAt} is null
      ), 0)::bigint`,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(
      and(
        isNull(bookings.deletedAt),
        sql`${bookings.status} <> 'cancelled'`,
        sql`${bookings.grandTotal} > coalesce((
          select sum(${receipts.amount}) from ${receipts}
          where ${receipts.bookingId} = "bookings"."id" and ${receipts.voidedAt} is null
        ), 0)`
      )
    )
    .orderBy(asc(bookings.endDate))
    .limit(200)
}
