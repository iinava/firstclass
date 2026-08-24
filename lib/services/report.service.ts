import "server-only"
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { expenses, receipts } from "@/db/schemas/accounts.schema"
import { bookings } from "@/db/schemas/booking.schema"
import { customers } from "@/db/schemas/customer.schema"
import { leads } from "@/db/schemas/lead.schema"
import { suppliers } from "@/db/schemas/supplier.schema"
import { tripCostItems } from "@/db/schemas/trip-cost.schema"
import { users } from "@/db/schemas/user.schema"
import { vehicles } from "@/db/schemas/vehicle.schema"
import { marginPercent, profit } from "@/lib/money"
import type { ReportParams } from "@/validations/accounts.validation"

/**
 * Default window: the whole current financial year (Apr–Mar), not year-to-date.
 *
 * Trips are filtered on their departure date, and a travel business books months
 * ahead — cutting the window at today would hide every confirmed upcoming trip
 * and report ₹0 revenue on a full order book.
 */
function resolveRange(params: ReportParams) {
  const now = new Date()
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const from = params.from ?? `${startYear}-04-01`
  const to = params.to ?? `${startYear + 1}-03-31`
  return { from, to }
}

/** Headline P&L for the selected window. */
export async function getProfitLoss(params: ReportParams) {
  const { from, to } = resolveRange(params)
  const window = and(
    isNull(bookings.deletedAt),
    sql`${bookings.status} <> 'cancelled'`,
    gte(bookings.startDate, from),
    lte(bookings.startDate, to)
  )

  const [[revenueRow], [costRow], [expenseRow], [receiptRow]] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(${bookings.grandTotal}), 0)::bigint`,
        trips: sql<number>`count(*)::int`,
        pax: sql<number>`coalesce(sum(${bookings.adults} + ${bookings.children}), 0)::int`,
      })
      .from(bookings)
      .where(window),

    db
      .select({
        cost: sql<number>`coalesce(sum(${tripCostItems.costAmount}), 0)::bigint`,
      })
      .from(tripCostItems)
      .innerJoin(bookings, eq(bookings.id, tripCostItems.bookingId))
      .where(and(window, isNull(tripCostItems.deletedAt), sql`${tripCostItems.status} <> 'cancelled'`)),

    db
      .select({ expense: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
      .from(expenses)
      .where(and(isNull(expenses.deletedAt), gte(expenses.spentAt, from), lte(expenses.spentAt, to))),

    db
      .select({ received: sql<number>`coalesce(sum(${receipts.amount}), 0)::bigint` })
      .from(receipts)
      .where(and(isNull(receipts.voidedAt), gte(receipts.receivedAt, from), lte(receipts.receivedAt, to))),
  ])

  const revenue = Number(revenueRow?.revenue ?? 0)
  const supplierCost = Number(costRow?.cost ?? 0)
  const directExpense = Number(expenseRow?.expense ?? 0)
  const cost = supplierCost + directExpense

  return {
    from,
    to,
    revenue,
    supplierCost,
    directExpense,
    cost,
    profit: profit(revenue, cost),
    margin: marginPercent(revenue, cost),
    trips: revenueRow?.trips ?? 0,
    pax: revenueRow?.pax ?? 0,
    collected: Number(receiptRow?.received ?? 0),
    averageTripValue: (revenueRow?.trips ?? 0) > 0 ? revenue / (revenueRow?.trips ?? 1) : 0,
  }
}

/** Revenue and cost broken down by trip — the client's headline requirement. */
export async function getRevenueByTrip(params: ReportParams) {
  const { from, to } = resolveRange(params)

  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      title: bookings.title,
      startDate: bookings.startDate,
      status: bookings.status,
      customerName: customers.name,
      revenue: bookings.grandTotal,
      cost: sql<number>`coalesce((
        select sum(${tripCostItems.costAmount}) from ${tripCostItems}
        where ${tripCostItems.bookingId} = "bookings"."id"
          and ${tripCostItems.deletedAt} is null
          and ${tripCostItems.status} <> 'cancelled'
      ), 0)::bigint + coalesce((
        select sum(${expenses.amount}) from ${expenses}
        where ${expenses.bookingId} = "bookings"."id" and ${expenses.deletedAt} is null
      ), 0)::bigint`,
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
        gte(bookings.startDate, from),
        lte(bookings.startDate, to)
      )
    )
    .orderBy(sql`${bookings.startDate} desc`)
    .limit(200)

  return rows.map((r) => {
    const revenue = Number(r.revenue)
    const cost = Number(r.cost)
    return {
      ...r,
      revenue,
      cost,
      received: Number(r.received),
      profit: profit(revenue, cost),
      margin: marginPercent(revenue, cost),
    }
  })
}

/** Expense by category — "expense per category" from the client's notes. */
export async function getExpenseByCategory(params: ReportParams) {
  const { from, to } = resolveRange(params)

  const [costRows, expenseRow] = await Promise.all([
    db
      .select({
        category: tripCostItems.category,
        amount: sql<number>`coalesce(sum(${tripCostItems.costAmount}), 0)::bigint`,
        lines: sql<number>`count(*)::int`,
      })
      .from(tripCostItems)
      .innerJoin(bookings, eq(bookings.id, tripCostItems.bookingId))
      .where(
        and(
          isNull(tripCostItems.deletedAt),
          sql`${tripCostItems.status} <> 'cancelled'`,
          isNull(bookings.deletedAt),
          gte(bookings.startDate, from),
          lte(bookings.startDate, to)
        )
      )
      .groupBy(tripCostItems.category),

    db
      .select({ amount: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
      .from(expenses)
      .where(
        and(isNull(expenses.deletedAt), gte(expenses.spentAt, from), lte(expenses.spentAt, to))
      ),
  ])

  const rows = costRows.map((r) => ({
    category: r.category as string,
    amount: Number(r.amount),
    lines: r.lines,
  }))

  const directExpense = Number(expenseRow[0]?.amount ?? 0)
  if (directExpense > 0) {
    rows.push({ category: "direct_expenses", amount: directExpense, lines: 0 })
  }

  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  return rows
    .map((r) => ({ ...r, share: total > 0 ? (r.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

/** Which suppliers the business actually depends on, and what it still owes. */
export async function getSupplierSpend(params: ReportParams) {
  const { from, to } = resolveRange(params)

  const rows = await db
    .select({
      supplierId: suppliers.id,
      name: suppliers.name,
      type: suppliers.type,
      spend: sql<number>`coalesce(sum(${tripCostItems.costAmount}), 0)::bigint`,
      paid: sql<number>`coalesce(sum(${tripCostItems.paidAmount}), 0)::bigint`,
      lines: sql<number>`count(*)::int`,
    })
    .from(tripCostItems)
    .innerJoin(suppliers, eq(suppliers.id, tripCostItems.supplierId))
    .innerJoin(bookings, eq(bookings.id, tripCostItems.bookingId))
    .where(
      and(
        isNull(tripCostItems.deletedAt),
        sql`${tripCostItems.status} <> 'cancelled'`,
        gte(bookings.startDate, from),
        lte(bookings.startDate, to)
      )
    )
    .groupBy(suppliers.id, suppliers.name, suppliers.type)
    .orderBy(sql`sum(${tripCostItems.costAmount}) desc`)
    .limit(50)

  return rows.map((r) => ({
    ...r,
    spend: Number(r.spend),
    paid: Number(r.paid),
    outstanding: Number(r.spend) - Number(r.paid),
  }))
}

/** Per-vehicle running cost — "vehicles expense per trip" from the notes. */
export async function getVehicleExpense(params: ReportParams) {
  const { from, to } = resolveRange(params)

  const rows = await db
    .select({
      vehicleId: vehicles.id,
      regNumber: vehicles.regNumber,
      type: vehicles.type,
      ownership: vehicles.ownership,
      tripCost: sql<number>`coalesce(sum(${tripCostItems.costAmount}), 0)::bigint`,
      trips: sql<number>`count(distinct ${tripCostItems.bookingId})::int`,
    })
    .from(tripCostItems)
    .innerJoin(vehicles, eq(vehicles.id, tripCostItems.vehicleId))
    .innerJoin(bookings, eq(bookings.id, tripCostItems.bookingId))
    .where(
      and(
        isNull(tripCostItems.deletedAt),
        gte(bookings.startDate, from),
        lte(bookings.startDate, to)
      )
    )
    .groupBy(vehicles.id, vehicles.regNumber, vehicles.type, vehicles.ownership)
    .orderBy(sql`sum(${tripCostItems.costAmount}) desc`)
    .limit(50)

  return rows.map((r) => ({
    ...r,
    tripCost: Number(r.tripCost),
    costPerTrip: r.trips > 0 ? Number(r.tripCost) / r.trips : 0,
  }))
}

/** Sales performance: enquiries handled, won, and revenue booked per person. */
export async function getStaffPerformance(params: ReportParams) {
  const { from, to } = resolveRange(params)

  const [leadRows, bookingRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: sql<string>`coalesce(${users.name}, ${users.username})`,
        total: sql<number>`count(*)::int`,
        won: sql<number>`count(*) filter (where ${leads.status} = 'won')::int`,
        lost: sql<number>`count(*) filter (where ${leads.status} = 'lost')::int`,
      })
      .from(leads)
      .innerJoin(users, eq(users.id, leads.assignedTo))
      .where(
        and(
          isNull(leads.deletedAt),
          gte(sql`${leads.createdAt}::date`, from),
          lte(sql`${leads.createdAt}::date`, to)
        )
      )
      .groupBy(users.id, users.name, users.username),

    db
      .select({
        userId: users.id,
        revenue: sql<number>`coalesce(sum(${bookings.grandTotal}), 0)::bigint`,
        trips: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.assignedTo))
      .where(
        and(
          isNull(bookings.deletedAt),
          sql`${bookings.status} <> 'cancelled'`,
          gte(bookings.startDate, from),
          lte(bookings.startDate, to)
        )
      )
      .groupBy(users.id),
  ])

  const revenueByUser = new Map(
    bookingRows.map((r) => [r.userId, { revenue: Number(r.revenue), trips: r.trips }])
  )

  return leadRows
    .map((r) => {
      const closed = r.won + r.lost
      const money = revenueByUser.get(r.userId)
      return {
        ...r,
        revenue: money?.revenue ?? 0,
        trips: money?.trips ?? 0,
        conversionRate: closed > 0 ? Math.round((r.won / closed) * 100) : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

/** Month-by-month revenue and profit for the trend chart. */
/**
 * Revenue, cost and profit per month.
 *
 * The outer table is written as `"bookings"."id"` rather than interpolated:
 * inside a raw `sql` template Drizzle emits a bare column name unless the query
 * has a join to disambiguate, and a bare `"id"` inside a correlated subquery
 * binds to the *inner* table. `trip_cost_items.booking_id = trip_cost_items.id`
 * is never true, so the cost silently summed to zero and every month reported
 * profit equal to revenue. Every correlated subquery in this layer spells the
 * outer table out for the same reason.
 */
export async function getMonthlyTrend(params: ReportParams) {
  const { from, to } = resolveRange(params)

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${bookings.startDate}::date), 'YYYY-MM')`,
      revenue: sql<number>`coalesce(sum(${bookings.grandTotal}), 0)::bigint`,
      trips: sql<number>`count(*)::int`,
      cost: sql<number>`coalesce(sum((
        select sum(${tripCostItems.costAmount}) from ${tripCostItems}
        where ${tripCostItems.bookingId} = "bookings"."id"
          and ${tripCostItems.deletedAt} is null
          and ${tripCostItems.status} <> 'cancelled'
      )), 0)::bigint`,
    })
    .from(bookings)
    .where(
      and(
        isNull(bookings.deletedAt),
        sql`${bookings.status} <> 'cancelled'`,
        gte(bookings.startDate, from),
        lte(bookings.startDate, to)
      )
    )
    .groupBy(sql`date_trunc('month', ${bookings.startDate}::date)`)
    .orderBy(sql`date_trunc('month', ${bookings.startDate}::date)`)

  return rows.map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
    cost: Number(r.cost),
    profit: profit(Number(r.revenue), Number(r.cost)),
    trips: r.trips,
  }))
}
