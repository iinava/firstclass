import "server-only"
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { users, type User } from "@/db/schemas/user.schema"
import { employees } from "@/db/schemas/hrms.schema"
import { leads } from "@/db/schemas/lead.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type { UserListParams } from "@/validations/user.validation"

export interface UserListRow {
  id: string
  username: string
  name: string | null
  email: string | null
  phone: string | null
  role: User["role"]
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  employeeName: string | null
  openLeads: number
}

export async function listUsers(
  params: UserListParams
): Promise<PaginatedResult<UserListRow>> {
  const { page, pageSize, search, sortDir, role, isActive } = params

  const filters = []
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(ilike(users.username, term), ilike(users.name, term), ilike(users.email, term))!
    )
  }
  if (role) filters.push(eq(users.role, role))
  if (isActive) filters.push(eq(users.isActive, isActive === "true"))
  const where = filters.length ? and(...filters) : undefined

  const rowsPromise = db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      employeeName: employees.name,
      openLeads: sql<number>`(
        select count(*)::int from ${leads}
        where ${leads.assignedTo} = "users"."id"
          and ${leads.deletedAt} is null
          and ${leads.status} in ('new','contacted','quoted','negotiating')
      )`,
    })
    .from(users)
    .leftJoin(employees, eq(employees.userId, users.id))
    .where(where)
    .orderBy(sortDir === "asc" ? asc(users.createdAt) : desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db.select({ value: count() }).from(users).where(where)
  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows as UserListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getUser(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

export async function findByUsername(username: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  return row ?? null
}

export async function createUser(values: typeof users.$inferInsert): Promise<User> {
  const [row] = await db.insert(users).values(values).returning()
  return row
}

export async function updateUser(
  id: string,
  values: Partial<typeof users.$inferInsert>
): Promise<User | null> {
  const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning()
  return row ?? null
}

/** Count of active superadmins — used to stop the last one locking everyone out. */
export async function countActiveSuperadmins(excludeId?: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(
      and(
        eq(users.role, "superadmin"),
        eq(users.isActive, true),
        excludeId ? sql`${users.id} <> ${excludeId}` : undefined
      )
    )
  return row?.value ?? 0
}

export async function touchLastLogin(id: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id))
}
