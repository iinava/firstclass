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
import { ActionFailure } from "@/lib/action"
import {
  attendance,
  employees,
  leaveRequests,
  type Attendance,
  type Employee,
  type LeaveRequest,
} from "@/db/schemas/hrms.schema"
import { users } from "@/db/schemas/user.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type {
  AttendanceListParams,
  EmployeeListParams,
  LeaveListParams,
} from "@/validations/hrms.validation"

const alive = isNull(employees.deletedAt)

export interface EmployeeListRow extends Employee {
  /** Days marked present in the current calendar month. */
  presentThisMonth: number
  pendingLeaves: number
}

export async function listEmployees(
  params: EmployeeListParams
): Promise<PaginatedResult<EmployeeListRow>> {
  const { page, pageSize, search, sortDir, status, department } = params

  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)

  const filters = [alive]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(employees.name, term),
        ilike(employees.empCode, term),
        ilike(employees.phone, term),
        ilike(employees.designation, term)
      )!
    )
  }
  if (status) filters.push(eq(employees.status, status))
  if (department) filters.push(ilike(employees.department, `%${department}%`))

  const where = and(...filters)
  const order = sortDir === "asc" ? asc(employees.name) : desc(employees.createdAt)

  const rowsPromise = db
    .select({
      id: employees.id,
      userId: employees.userId,
      empCode: employees.empCode,
      name: employees.name,
      phone: employees.phone,
      email: employees.email,
      designation: employees.designation,
      department: employees.department,
      dateOfJoining: employees.dateOfJoining,
      dateOfBirth: employees.dateOfBirth,
      address: employees.address,
      monthlySalary: employees.monthlySalary,
      emergencyContact: employees.emergencyContact,
      status: employees.status,
      notes: employees.notes,
      createdBy: employees.createdBy,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      deletedAt: employees.deletedAt,
      presentThisMonth: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.employeeId} = "employees"."id"
          and ${attendance.date} >= ${monthStartStr}
          and ${attendance.status} in ('present','half_day')
      )`,
      pendingLeaves: sql<number>`(
        select count(*)::int from ${leaveRequests}
        where ${leaveRequests.employeeId} = "employees"."id"
          and ${leaveRequests.status} = 'pending'
      )`,
    })
    .from(employees)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db.select({ value: count() }).from(employees).where(where)
  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows as EmployeeListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), alive))
    .limit(1)
  return row ?? null
}

export async function createEmployee(
  values: typeof employees.$inferInsert
): Promise<Employee> {
  const [row] = await db.insert(employees).values(values).returning()
  return row
}

export async function updateEmployee(
  id: string,
  values: Partial<typeof employees.$inferInsert>
): Promise<Employee | null> {
  const [row] = await db
    .update(employees)
    .set(values)
    .where(and(eq(employees.id, id), alive))
    .returning()
  return row ?? null
}

export async function softDeleteEmployee(id: string): Promise<void> {
  await db
    .update(employees)
    .set({ deletedAt: new Date() })
    .where(and(eq(employees.id, id), alive))
}

export async function getUnlinkedUsers() {
  return db
    .select({
      id: users.id,
      name: sql<string>`coalesce(${users.name}, ${users.username})`,
      role: users.role,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.username))
}

// ---------------------------------------------------------------- attendance

export interface AttendanceDayRow {
  employeeId: string
  empCode: string
  name: string
  designation: string | null
  attendanceId: string | null
  status: Attendance["status"] | null
  checkIn: string | null
  checkOut: string | null
  notes: string | null
}

/**
 * One row per active employee for a given date, whether or not attendance has
 * been marked — the register is a grid to fill in, not a list of what exists.
 */
export async function getAttendanceForDate(date: string): Promise<AttendanceDayRow[]> {
  const rows = await db
    .select({
      employeeId: employees.id,
      empCode: employees.empCode,
      name: employees.name,
      designation: employees.designation,
      attendanceId: attendance.id,
      status: attendance.status,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      notes: attendance.notes,
    })
    .from(employees)
    .leftJoin(
      attendance,
      and(eq(attendance.employeeId, employees.id), eq(attendance.date, date))
    )
    .where(and(alive, sql`${employees.status} in ('active','on_leave')`))
    .orderBy(asc(employees.name))

  return rows as AttendanceDayRow[]
}

export async function upsertAttendance(values: typeof attendance.$inferInsert) {
  const [row] = await db
    .insert(attendance)
    .values(values)
    .onConflictDoUpdate({
      target: [attendance.employeeId, attendance.date],
      set: {
        status: values.status,
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        workedMinutes: values.workedMinutes,
        notes: values.notes,
        markedBy: values.markedBy,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

/** Monthly summary per employee, for payroll hand-off. */
export async function getAttendanceSummary(params: AttendanceListParams) {
  const from = params.from ?? new Date().toISOString().slice(0, 8) + "01"
  const to = params.to ?? new Date().toISOString().slice(0, 10)

  const rows = await db
    .select({
      employeeId: employees.id,
      empCode: employees.empCode,
      name: employees.name,
      present: sql<number>`count(*) filter (where ${attendance.status} = 'present')::int`,
      halfDay: sql<number>`count(*) filter (where ${attendance.status} = 'half_day')::int`,
      absent: sql<number>`count(*) filter (where ${attendance.status} = 'absent')::int`,
      leave: sql<number>`count(*) filter (where ${attendance.status} = 'leave')::int`,
      marked: sql<number>`count(${attendance.id})::int`,
    })
    .from(employees)
    .leftJoin(
      attendance,
      and(
        eq(attendance.employeeId, employees.id),
        gte(attendance.date, from),
        lte(attendance.date, to)
      )
    )
    .where(alive)
    .groupBy(employees.id, employees.empCode, employees.name)
    .orderBy(asc(employees.name))

  return rows.map((r) => ({
    ...r,
    // A half day counts as 0.5 for payroll.
    payableDays: r.present + r.halfDay * 0.5,
  }))
}

// ------------------------------------------------------------------- leaves

export interface LeaveListRow extends LeaveRequest {
  employeeName: string
  empCode: string
}

export async function listLeaves(
  params: LeaveListParams
): Promise<PaginatedResult<LeaveListRow>> {
  const { page, pageSize, status, employeeId } = params

  const filters = []
  if (status) filters.push(eq(leaveRequests.status, status))
  if (employeeId) filters.push(eq(leaveRequests.employeeId, employeeId))
  const where = filters.length ? and(...filters) : undefined

  const rowsPromise = db
    .select({
      id: leaveRequests.id,
      employeeId: leaveRequests.employeeId,
      type: leaveRequests.type,
      fromDate: leaveRequests.fromDate,
      toDate: leaveRequests.toDate,
      days: leaveRequests.days,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      decidedBy: leaveRequests.decidedBy,
      decidedAt: leaveRequests.decidedAt,
      decisionNote: leaveRequests.decisionNote,
      createdAt: leaveRequests.createdAt,
      updatedAt: leaveRequests.updatedAt,
      employeeName: employees.name,
      empCode: employees.empCode,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(where)
    .orderBy(desc(leaveRequests.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db
    .select({ value: count() })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(where)

  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows as LeaveListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function createLeave(values: typeof leaveRequests.$inferInsert) {
  const overlapping = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, values.employeeId),
        inArray(leaveRequests.status, ["pending", "approved"]),
        lte(leaveRequests.fromDate, values.toDate),
        gte(leaveRequests.toDate, values.fromDate)
      )
    )
    .limit(1)
  if (overlapping.length) {
    throw new ActionFailure(
      "This employee already has a leave request covering these dates"
    )
  }

  const [row] = await db.insert(leaveRequests).values(values).returning()
  return row
}

export async function decideLeave(
  id: string,
  values: Partial<typeof leaveRequests.$inferInsert>
) {
  const [row] = await db
    .update(leaveRequests)
    .set(values)
    .where(eq(leaveRequests.id, id))
    .returning()
  if (!row) return null

  if (row.status === "approved") {
    await markLeaveAttendance(row)
  }

  return row
}

/** "2026-08-01" .. "2026-08-03" -> each date string in between, inclusive. */
function datesInRange(from: string, to: string): string[] {
  const dates: string[] = []
  let cursor = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }
  return dates
}

/**
 * Stamps the attendance register for an approved leave, so payroll (which only
 * reads attendance) knows those days were leave rather than ordinary present
 * days — and whether they're paid or unpaid.
 */
async function markLeaveAttendance(leave: LeaveRequest): Promise<void> {
  const status = leave.type === "unpaid" ? "leave_unpaid" : "leave"
  for (const date of datesInRange(leave.fromDate, leave.toDate)) {
    await upsertAttendance({
      employeeId: leave.employeeId,
      date,
      status,
      checkIn: null,
      checkOut: null,
      workedMinutes: null,
      notes: null,
      markedBy: leave.decidedBy,
    })
  }
}
