import "server-only"
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { db } from "@/db/drizzle"
import { customers } from "@/db/schemas/customer.schema"
import {
  leadActivities,
  leadFollowups,
  leads,
  type Lead,
} from "@/db/schemas/lead.schema"
import { users } from "@/db/schemas/user.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type { LeadListParams } from "@/validations/lead.validation"

const alive = isNull(leads.deletedAt)

const SORTABLE = {
  code: leads.code,
  travelDate: leads.travelDate,
  budget: leads.budget,
  status: leads.status,
  createdAt: leads.createdAt,
} as const

export interface LeadListRow {
  id: string
  code: string
  status: Lead["status"]
  priority: Lead["priority"]
  source: Lead["source"]
  destination: string | null
  travelDate: string | null
  adults: number
  children: number
  budget: number | null
  requirements: string | null
  createdAt: Date
  customerId: string
  customerName: string
  customerPhone: string
  assignedTo: string | null
  assigneeName: string | null
  /** Soonest pending follow-up, driving the "next action" column. */
  nextFollowupAt: Date | null
  pendingFollowups: number
}

const listSelection = {
  id: leads.id,
  code: leads.code,
  status: leads.status,
  priority: leads.priority,
  source: leads.source,
  destination: leads.destination,
  travelDate: leads.travelDate,
  adults: leads.adults,
  children: leads.children,
  budget: leads.budget,
  requirements: leads.requirements,
  createdAt: leads.createdAt,
  customerId: leads.customerId,
  customerName: customers.name,
  customerPhone: customers.phone,
  assignedTo: leads.assignedTo,
  assigneeName: sql<string | null>`coalesce(${users.name}, ${users.username})`,
  nextFollowupAt: sql<Date | null>`(
    select min(${leadFollowups.dueAt}) from ${leadFollowups}
    where ${leadFollowups.leadId} = "leads"."id"
      and ${leadFollowups.status} = 'pending'
  )`,
  pendingFollowups: sql<number>`(
    select count(*)::int from ${leadFollowups}
    where ${leadFollowups.leadId} = "leads"."id"
      and ${leadFollowups.status} = 'pending'
  )`,
}

export async function listLeads(
  params: LeadListParams,
  /** Set for users without `lead:view_all` — restricts to their own pipeline. */
  restrictToUserId?: string | null
): Promise<PaginatedResult<LeadListRow>> {
  const { page, pageSize, search, sortBy, sortDir, status, priority, source, assignedTo, from, to } =
    params

  const filters = [alive]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(leads.code, term),
        ilike(leads.destination, term),
        ilike(customers.name, term),
        ilike(customers.phone, term)
      )!
    )
  }
  if (status) filters.push(eq(leads.status, status))
  if (priority) filters.push(eq(leads.priority, priority))
  if (source) filters.push(eq(leads.source, source))
  if (assignedTo) filters.push(eq(leads.assignedTo, assignedTo))
  if (from) filters.push(gte(leads.createdAt, new Date(`${from}T00:00:00.000Z`)))
  if (to) filters.push(lte(leads.createdAt, new Date(`${to}T23:59:59.999Z`)))
  if (restrictToUserId) filters.push(eq(leads.assignedTo, restrictToUserId))

  const where = and(...filters)
  const column = SORTABLE[sortBy as keyof typeof SORTABLE] ?? leads.createdAt
  const order = sortDir === "asc" ? asc(column) : desc(column)

  const rowsPromise = db
    .select(listSelection)
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .leftJoin(users, eq(users.id, leads.assignedTo))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db
    .select({ value: count() })
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows as LeadListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getLead(id: string) {
  const [row] = await db
    .select(listSelection)
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .leftJoin(users, eq(users.id, leads.assignedTo))
    .where(and(eq(leads.id, id), alive))
    .limit(1)
  return (row as LeadListRow | undefined) ?? null
}

export async function getLeadRaw(id: string): Promise<Lead | null> {
  const [row] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), alive))
    .limit(1)
  return row ?? null
}

/** Counts behind the pipeline tiles on the leads page. */
export async function getLeadStats(restrictToUserId?: string | null) {
  const filters = [alive]
  if (restrictToUserId) filters.push(eq(leads.assignedTo, restrictToUserId))

  const rows = await db
    .select({ status: leads.status, value: count() })
    .from(leads)
    .where(and(...filters))
    .groupBy(leads.status)

  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.value])) as Record<
    Lead["status"],
    number | undefined
  >

  const open =
    (byStatus.new ?? 0) +
    (byStatus.contacted ?? 0) +
    (byStatus.quoted ?? 0) +
    (byStatus.negotiating ?? 0)
  const won = byStatus.won ?? 0
  const lost = byStatus.lost ?? 0
  const closed = won + lost

  return {
    total: open + closed,
    open,
    won,
    lost,
    byStatus,
    /** Win rate is only meaningful against closed leads, not the whole pipeline. */
    conversionRate: closed > 0 ? Math.round((won / closed) * 100) : 0,
  }
}

export async function createLead(
  values: typeof leads.$inferInsert
): Promise<Lead> {
  const [row] = await db.insert(leads).values(values).returning()
  return row
}

export async function updateLead(
  id: string,
  values: Partial<typeof leads.$inferInsert>
): Promise<Lead | null> {
  const [row] = await db
    .update(leads)
    .set(values)
    .where(and(eq(leads.id, id), alive))
    .returning()
  return row ?? null
}

export async function softDeleteLead(id: string): Promise<void> {
  await db
    .update(leads)
    .set({ deletedAt: new Date() })
    .where(and(eq(leads.id, id), alive))
}

// ------------------------------------------------------------------ activity

export async function logActivity(
  leadId: string,
  type: string,
  description: string,
  userId?: string | null
): Promise<void> {
  await db.insert(leadActivities).values({
    leadId,
    type,
    description,
    createdBy: userId ?? null,
  })
}

export async function getLeadActivities(leadId: string, limit = 50) {
  return db
    .select({
      id: leadActivities.id,
      type: leadActivities.type,
      description: leadActivities.description,
      createdAt: leadActivities.createdAt,
      userName: sql<string | null>`coalesce(${users.name}, ${users.username})`,
    })
    .from(leadActivities)
    .leftJoin(users, eq(users.id, leadActivities.createdBy))
    .where(eq(leadActivities.leadId, leadId))
    .orderBy(desc(leadActivities.createdAt))
    .limit(limit)
}

/** Marks pending follow-ups whose due date has passed as missed. */
export async function sweepMissedFollowups(): Promise<number> {
  const result = await db
    .update(leadFollowups)
    .set({ status: "missed" })
    .where(
      and(
        eq(leadFollowups.status, "pending"),
        lte(leadFollowups.dueAt, new Date()),
        // Only sweep things more than a day overdue — "due earlier today" is
        // still actionable and shouldn't be marked missed.
        sql`${leadFollowups.dueAt} < now() - interval '1 day'`
      )
    )
    .returning({ id: leadFollowups.id })
  return result.length
}

/** Users who can own a lead, for the assignee dropdown. */
export async function getAssignableUsers() {
  return db
    .select({
      id: users.id,
      name: sql<string>`coalesce(${users.name}, ${users.username})`,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        inArray(users.role, ["superadmin", "admin", "manager", "sales", "ops"])
      )
    )
    .orderBy(asc(users.username))
}
