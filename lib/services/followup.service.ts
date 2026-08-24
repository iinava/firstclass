import "server-only"
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { db } from "@/db/drizzle"
import { customers } from "@/db/schemas/customer.schema"
import { leadFollowups, leads, type LeadFollowup } from "@/db/schemas/lead.schema"
import { users } from "@/db/schemas/user.schema"
import { sweepMissedFollowups } from "@/lib/services/lead.service"
import type { PaginatedResult } from "@/validations/common.validation"
import type { FollowupQueueParams } from "@/validations/lead.validation"

export interface FollowupRow {
  id: string
  leadId: string
  dueAt: Date
  channel: LeadFollowup["channel"]
  status: LeadFollowup["status"]
  note: string | null
  outcome: string | null
  completedAt: Date | null
  assignedTo: string | null
  assigneeName: string | null
  leadCode: string
  leadStatus: string
  destination: string | null
  customerId: string
  customerName: string
  customerPhone: string
}

const selection = {
  id: leadFollowups.id,
  leadId: leadFollowups.leadId,
  dueAt: leadFollowups.dueAt,
  channel: leadFollowups.channel,
  status: leadFollowups.status,
  note: leadFollowups.note,
  outcome: leadFollowups.outcome,
  completedAt: leadFollowups.completedAt,
  assignedTo: leadFollowups.assignedTo,
  assigneeName: sql<string | null>`coalesce(${users.name}, ${users.username})`,
  leadCode: leads.code,
  leadStatus: leads.status,
  destination: leads.destination,
  customerId: leads.customerId,
  customerName: customers.name,
  customerPhone: customers.phone,
}

/**
 * Date-bucket filter for the queue tabs.
 *
 * "Today" deliberately includes anything already overdue *today* — a call that
 * slipped by two hours is still today's work, not a separate category.
 */
function bucketFilter(bucket: FollowupQueueParams["bucket"]) {
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  const endOfWeek = new Date(startOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  switch (bucket) {
    case "overdue":
      return lt(leadFollowups.dueAt, startOfToday)
    case "today":
      return and(gte(leadFollowups.dueAt, startOfToday), lte(leadFollowups.dueAt, endOfToday))
    case "week":
      return and(gte(leadFollowups.dueAt, startOfToday), lte(leadFollowups.dueAt, endOfWeek))
    case "upcoming":
      return gte(leadFollowups.dueAt, startOfToday)
    case "all":
    default:
      return undefined
  }
}

export async function listFollowups(
  params: FollowupQueueParams,
  restrictToUserId?: string | null
): Promise<PaginatedResult<FollowupRow>> {
  await sweepMissedFollowups()

  const { page, pageSize, bucket, assignedTo, status, search } = params

  const filters = [isNull(leads.deletedAt)]
  // The queue is about outstanding work, so default to pending only.
  filters.push(status ? eq(leadFollowups.status, status) : eq(leadFollowups.status, "pending"))

  const bucketClause = bucketFilter(bucket)
  if (bucketClause) filters.push(bucketClause)
  if (assignedTo) filters.push(eq(leadFollowups.assignedTo, assignedTo))
  if (restrictToUserId) filters.push(eq(leadFollowups.assignedTo, restrictToUserId))
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(customers.name, term),
        ilike(customers.phone, term),
        ilike(leads.code, term)
      )!
    )
  }

  const where = and(...filters)

  const rowsPromise = db
    .select(selection)
    .from(leadFollowups)
    .innerJoin(leads, eq(leads.id, leadFollowups.leadId))
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .leftJoin(users, eq(users.id, leadFollowups.assignedTo))
    .where(where)
    .orderBy(asc(leadFollowups.dueAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db
    .select({ value: count() })
    .from(leadFollowups)
    .innerJoin(leads, eq(leads.id, leadFollowups.leadId))
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows as FollowupRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Badge counts on the queue tabs. */
export async function getFollowupCounts(restrictToUserId?: string | null) {
  await sweepMissedFollowups()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const endOfWeek = new Date(startOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const base = [eq(leadFollowups.status, "pending"), isNull(leads.deletedAt)]
  if (restrictToUserId) base.push(eq(leadFollowups.assignedTo, restrictToUserId))

  const [row] = await db
    .select({
      overdue: sql<number>`count(*) filter (where ${leadFollowups.dueAt} < ${startOfToday})::int`,
      today: sql<number>`count(*) filter (where ${leadFollowups.dueAt} >= ${startOfToday} and ${leadFollowups.dueAt} <= ${endOfToday})::int`,
      week: sql<number>`count(*) filter (where ${leadFollowups.dueAt} >= ${startOfToday} and ${leadFollowups.dueAt} <= ${endOfWeek})::int`,
      upcoming: sql<number>`count(*) filter (where ${leadFollowups.dueAt} >= ${startOfToday})::int`,
      all: sql<number>`count(*)::int`,
    })
    .from(leadFollowups)
    .innerJoin(leads, eq(leads.id, leadFollowups.leadId))
    .where(and(...base))

  return row ?? { overdue: 0, today: 0, week: 0, upcoming: 0, all: 0 }
}

export async function listFollowupsByLead(leadId: string) {
  return db
    .select(selection)
    .from(leadFollowups)
    .innerJoin(leads, eq(leads.id, leadFollowups.leadId))
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .leftJoin(users, eq(users.id, leadFollowups.assignedTo))
    .where(eq(leadFollowups.leadId, leadId))
    .orderBy(desc(leadFollowups.dueAt))
}

export async function getFollowup(id: string): Promise<LeadFollowup | null> {
  const [row] = await db
    .select()
    .from(leadFollowups)
    .where(eq(leadFollowups.id, id))
    .limit(1)
  return row ?? null
}

export async function createFollowup(
  values: typeof leadFollowups.$inferInsert
): Promise<LeadFollowup> {
  const [row] = await db.insert(leadFollowups).values(values).returning()
  return row
}

export async function updateFollowup(
  id: string,
  values: Partial<typeof leadFollowups.$inferInsert>
): Promise<LeadFollowup | null> {
  const [row] = await db
    .update(leadFollowups)
    .set(values)
    .where(eq(leadFollowups.id, id))
    .returning()
  return row ?? null
}

export async function deleteFollowup(id: string): Promise<void> {
  await db.delete(leadFollowups).where(eq(leadFollowups.id, id))
}
