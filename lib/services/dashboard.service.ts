import "server-only"
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { bookings } from "@/db/schemas/booking.schema"
import { customers } from "@/db/schemas/customer.schema"
import { leadFollowups, leads } from "@/db/schemas/lead.schema"

/**
 * Everything the dashboard needs, gathered concurrently.
 *
 * These are all cheap aggregate queries; running them in parallel keeps the
 * whole panel inside one streamed Suspense chunk.
 */
export async function getDashboardSummary(restrictToUserId?: string | null) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  const leadScope = restrictToUserId ? eq(leads.assignedTo, restrictToUserId) : undefined
  const bookingScope = restrictToUserId
    ? eq(bookings.assignedTo, restrictToUserId)
    : undefined

  const [
    [leadCounts],
    [bookingCounts],
    [moneyRow],
    [followupRow],
    upcomingTrips,
    recentLeads,
  ] = await Promise.all([
    db
      .select({
        open: sql<number>`count(*) filter (where ${leads.status} in ('new','contacted','quoted','negotiating'))::int`,
        newThisMonth: sql<number>`count(*) filter (where ${leads.createdAt} >= ${startOfMonth})::int`,
        wonThisMonth: sql<number>`count(*) filter (where ${leads.status} = 'won' and ${leads.closedAt} >= ${startOfMonth})::int`,
        lostThisMonth: sql<number>`count(*) filter (where ${leads.status} = 'lost' and ${leads.closedAt} >= ${startOfMonth})::int`,
      })
      .from(leads)
      .where(and(isNull(leads.deletedAt), leadScope)),

    db
      .select({
        active: sql<number>`count(*) filter (where ${bookings.status} in ('confirmed','in_progress'))::int`,
        thisMonth: sql<number>`count(*) filter (where ${bookings.createdAt} >= ${startOfMonth})::int`,
        travellingNow: sql<number>`count(*) filter (where ${bookings.status} = 'in_progress')::int`,
      })
      .from(bookings)
      .where(and(isNull(bookings.deletedAt), bookingScope)),

    db
      .select({
        // Value booked this month. Cancelled trips are excluded — they are not
        // business won, and every other aggregate in the app drops them too.
        bookedValue: sql<number>`coalesce(sum(${bookings.grandTotal}) filter (where ${bookings.createdAt} >= ${startOfMonth} and ${bookings.status} <> 'cancelled'), 0)::bigint`,
        // Total value of trips still to run — not the balance due on them.
        activeValue: sql<number>`coalesce(sum(${bookings.grandTotal}) filter (where ${bookings.status} in ('confirmed','in_progress')), 0)::bigint`,
      })
      .from(bookings)
      .where(and(isNull(bookings.deletedAt), bookingScope)),

    db
      .select({
        overdue: sql<number>`count(*) filter (where ${leadFollowups.dueAt} < ${startOfToday})::int`,
        today: sql<number>`count(*) filter (where ${leadFollowups.dueAt} >= ${startOfToday} and ${leadFollowups.dueAt} <= ${endOfToday})::int`,
      })
      .from(leadFollowups)
      .innerJoin(leads, eq(leads.id, leadFollowups.leadId))
      .where(
        and(
          eq(leadFollowups.status, "pending"),
          isNull(leads.deletedAt),
          restrictToUserId ? eq(leadFollowups.assignedTo, restrictToUserId) : undefined
        )
      ),

    db
      .select({
        id: bookings.id,
        code: bookings.code,
        title: bookings.title,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        status: bookings.status,
        grandTotal: bookings.grandTotal,
        customerName: customers.name,
      })
      .from(bookings)
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(
        and(
          isNull(bookings.deletedAt),
          gte(bookings.startDate, startOfToday.toISOString().slice(0, 10)),
          bookingScope
        )
      )
      .orderBy(bookings.startDate)
      .limit(6),

    db
      .select({
        id: leads.id,
        code: leads.code,
        status: leads.status,
        destination: leads.destination,
        createdAt: leads.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(leads)
      .innerJoin(customers, eq(customers.id, leads.customerId))
      .where(and(isNull(leads.deletedAt), leadScope))
      .orderBy(desc(leads.createdAt))
      .limit(6),
  ])

  const closed = (leadCounts?.wonThisMonth ?? 0) + (leadCounts?.lostThisMonth ?? 0)

  return {
    leads: {
      open: leadCounts?.open ?? 0,
      newThisMonth: leadCounts?.newThisMonth ?? 0,
      wonThisMonth: leadCounts?.wonThisMonth ?? 0,
      conversionRate:
        closed > 0 ? Math.round(((leadCounts?.wonThisMonth ?? 0) / closed) * 100) : 0,
    },
    bookings: {
      active: bookingCounts?.active ?? 0,
      thisMonth: bookingCounts?.thisMonth ?? 0,
      travellingNow: bookingCounts?.travellingNow ?? 0,
    },
    money: {
      bookedValue: Number(moneyRow?.bookedValue ?? 0),
      activeValue: Number(moneyRow?.activeValue ?? 0),
    },
    followups: {
      overdue: followupRow?.overdue ?? 0,
      today: followupRow?.today ?? 0,
    },
    upcomingTrips,
    recentLeads,
  }
}

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>
