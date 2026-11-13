import "server-only"
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm"
import { db, type Tx } from "@/db/drizzle"
import { expenses, expenseCategories } from "@/db/schemas/accounts.schema"
import { attendance, employees } from "@/db/schemas/hrms.schema"
import {
  payrollLines,
  payrollRuns,
  salaryAdvances,
  type PayrollRun,
} from "@/db/schemas/payroll.schema"

/** The expense category salary postings land in. */
const SALARY_CATEGORY = "Salaries"

export interface PayrollLinePreview {
  employeeId: string
  empCode: string
  name: string
  designation: string | null
  monthlySalary: number
  dayRate: number
  daysInMonth: number
  /** This employee's paid-leave allowance for the month, as set on their record. */
  paidLeaveAllowance: number
  daysPresent: number
  daysHalf: number
  daysAbsent: number
  daysPaidLeave: number
  daysUnpaidLeave: number
  daysHoliday: number
  daysWeekOff: number
  daysUnmarked: number
  /** Unpaid days as a number, counting a half-day as 0.5. */
  unpaidDays: number
  deduction: number
  /** Salary advances recovered from this month's pay (already paid out). */
  advance: number
  /** What is left to pay: monthlySalary - deduction - advance. */
  netPay: number
}

export interface PayrollPreview {
  month: string
  monthLabel: string
  daysInMonth: number
  lines: PayrollLinePreview[]
  grossTotal: number
  deductionTotal: number
  advanceTotal: number
  netTotal: number
  /**
   * Advances that cannot be recovered from this month as it stands — larger than
   * the employee's pay, or taken by someone not on this run. Posting is refused
   * until each is moved to another month or removed, so no advance is lost.
   */
  advanceIssues: { employeeId: string; name: string; advance: number; payable: number }[]
  /** Set once the month has been posted — the figures are then history. */
  posted: {
    runId: string
    postedAt: Date
    netTotal: number
  } | null
  /** Employees skipped because they have no day rate on record. */
  missingSalary: { employeeId: string; name: string; empCode: string }[]
}

/** "2026-08" or "2026-08-01" -> the first of that month, as YYYY-MM-DD. */
export function normaliseMonth(input: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(input)
  if (!match) throw new Error(`Not a month: ${input}`)
  return `${match[1]}-${match[2]}-01`
}

function monthBounds(month: string) {
  const first = normaliseMonth(month)
  const [year, mon] = first.split("-").map(Number)
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const last = `${first.slice(0, 8)}${String(daysInMonth).padStart(2, "0")}`
  const label = new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  return { first, last, daysInMonth, label }
}

/**
 * What each employee is owed for a month, read off the attendance register.
 *
 * Deliberately computed rather than stored: attendance gets corrected right up
 * to the day salaries go out, and a figure cached before that would be wrong in
 * a way nobody notices. Once the month is posted the stored lines are the
 * record, and this returns those instead.
 *
 *   day rate  = set directly on the employee record — the input, not derived
 *   unpaid    = absent + leave beyond the employee's own monthly allowance +
 *               unpaid leave + half a day per half-day
 *   deduction = unpaid days x day rate
 *
 * Holidays, week-offs and days nobody marked are paid. Unmarked days are counted
 * separately so an incomplete register is visible rather than silently generous.
 */
export async function getPayrollPreview(month: string): Promise<PayrollPreview> {
  const { first, last, daysInMonth, label } = monthBounds(month)

  const existing = await getRun(first)
  if (existing) return storedPreview(existing, label)

  const [staff, marks, advances] = await Promise.all([
    db
      .select({
        id: employees.id,
        empCode: employees.empCode,
        name: employees.name,
        designation: employees.designation,
        dayRate: employees.dayRate,
        paidLeavesPerMonth: employees.paidLeavesPerMonth,
      })
      .from(employees)
      .where(
        and(
          inArray(employees.status, ["active", "on_leave"]),
          sql`${employees.deletedAt} is null`
        )
      )
      .orderBy(asc(employees.name)),

    db
      .select({
        employeeId: attendance.employeeId,
        status: attendance.status,
        days: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .where(and(gte(attendance.date, first), lte(attendance.date, last)))
      .groupBy(attendance.employeeId, attendance.status),

    db
      .select({
        employeeId: salaryAdvances.employeeId,
        name: employees.name,
        total: sql<number>`coalesce(sum(${salaryAdvances.amount}), 0)::bigint`,
      })
      .from(salaryAdvances)
      .innerJoin(employees, eq(employees.id, salaryAdvances.employeeId))
      .where(and(eq(salaryAdvances.month, first), isNull(salaryAdvances.deletedAt)))
      .groupBy(salaryAdvances.employeeId, employees.name),
  ])

  const advanceBy = new Map(advances.map((a) => [a.employeeId, Number(a.total)]))
  const advanceIssues: PayrollPreview["advanceIssues"] = []

  const byEmployee = new Map<string, Record<string, number>>()
  for (const mark of marks) {
    const row = byEmployee.get(mark.employeeId) ?? {}
    row[mark.status] = Number(mark.days)
    byEmployee.set(mark.employeeId, row)
  }

  const lines: PayrollLinePreview[] = []
  const missingSalary: PayrollPreview["missingSalary"] = []

  for (const person of staff) {
    const dayRate = Number(person.dayRate ?? 0)
    if (!dayRate) {
      missingSalary.push({
        employeeId: person.id,
        name: person.name,
        empCode: person.empCode,
      })
      continue
    }
    const paidLeaveAllowance = person.paidLeavesPerMonth
    const salary = dayRate * daysInMonth

    const counts = byEmployee.get(person.id) ?? {}
    const daysPresent = counts.present ?? 0
    const daysHalf = counts.half_day ?? 0
    const daysAbsent = counts.absent ?? 0
    const leaveDays = counts.leave ?? 0
    const leaveDaysUnpaid = counts.leave_unpaid ?? 0
    const daysHoliday = counts.holiday ?? 0
    const daysWeekOff = counts.week_off ?? 0

    // Only leave marked as paid-eligible draws on the monthly allowance —
    // leave approved as "unpaid" is deducted in full regardless.
    const daysPaidLeave = Math.min(leaveDays, paidLeaveAllowance)
    const daysUnpaidLeave =
      Math.max(0, leaveDays - paidLeaveAllowance) + leaveDaysUnpaid

    const marked =
      daysPresent +
      daysHalf +
      daysAbsent +
      leaveDays +
      leaveDaysUnpaid +
      daysHoliday +
      daysWeekOff
    const daysUnmarked = Math.max(0, daysInMonth - marked)

    const unpaidDays = daysAbsent + daysUnpaidLeave + daysHalf * 0.5
    // Never deduct more than the salary — a register with more absences than
    // days in the month would otherwise produce a negative payout.
    const deduction = Math.min(salary, Math.round(dayRate * unpaidDays))

    const earned = salary - deduction
    const advance = advanceBy.get(person.id) ?? 0
    advanceBy.delete(person.id)
    if (advance > earned) {
      advanceIssues.push({ employeeId: person.id, name: person.name, advance, payable: earned })
    }

    lines.push({
      employeeId: person.id,
      empCode: person.empCode,
      name: person.name,
      designation: person.designation,
      monthlySalary: salary,
      dayRate,
      daysInMonth,
      paidLeaveAllowance,
      daysPresent,
      daysHalf,
      daysAbsent,
      daysPaidLeave,
      daysUnpaidLeave,
      daysHoliday,
      daysWeekOff,
      daysUnmarked,
      unpaidDays,
      deduction,
      advance,
      netPay: Math.max(0, earned - advance),
    })
  }

  // Whatever is left belongs to someone not on this run (no day rate, or no
  // longer active) — there is no pay to recover it from.
  for (const a of advances) {
    if (advanceBy.has(a.employeeId)) {
      advanceIssues.push({
        employeeId: a.employeeId,
        name: a.name,
        advance: Number(a.total),
        payable: 0,
      })
    }
  }

  return {
    month: first,
    monthLabel: label,
    daysInMonth,
    lines,
    grossTotal: lines.reduce((sum, l) => sum + l.monthlySalary, 0),
    deductionTotal: lines.reduce((sum, l) => sum + l.deduction, 0),
    advanceTotal: lines.reduce((sum, l) => sum + l.advance, 0),
    netTotal: lines.reduce((sum, l) => sum + l.netPay, 0),
    advanceIssues,
    posted: null,
    missingSalary,
  }
}

async function getRun(month: string): Promise<PayrollRun | null> {
  const [row] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.month, month))
    .limit(1)
  return row ?? null
}

/** A posted month, read back from its stored lines rather than recomputed. */
async function storedPreview(
  run: PayrollRun,
  label: string
): Promise<PayrollPreview> {
  const rows = await db
    .select({
      line: payrollLines,
      empCode: employees.empCode,
      name: employees.name,
      designation: employees.designation,
    })
    .from(payrollLines)
    .innerJoin(employees, eq(employees.id, payrollLines.employeeId))
    .where(eq(payrollLines.runId, run.id))
    .orderBy(asc(employees.name))

  const lines: PayrollLinePreview[] = rows.map(({ line, empCode, name, designation }) => ({
    employeeId: line.employeeId,
    empCode,
    name,
    designation,
    monthlySalary: Number(line.monthlySalary),
    dayRate: Number(line.dayRate),
    daysInMonth: line.daysInMonth,
    paidLeaveAllowance: line.paidLeaveAllowance,
    daysPresent: line.daysPresent,
    daysHalf: line.daysHalf,
    daysAbsent: line.daysAbsent,
    daysPaidLeave: line.daysPaidLeave,
    daysUnpaidLeave: line.daysUnpaidLeave,
    daysHoliday: line.daysHoliday,
    daysWeekOff: line.daysWeekOff,
    daysUnmarked: line.daysUnmarked,
    unpaidDays: line.daysAbsent + line.daysUnpaidLeave + line.daysHalf * 0.5,
    deduction: Number(line.deduction),
    advance: Number(line.advance),
    netPay: Number(line.netPay),
  }))

  return {
    month: run.month,
    monthLabel: label,
    daysInMonth: lines[0]?.daysInMonth ?? 0,
    lines,
    grossTotal: Number(run.grossTotal),
    deductionTotal: Number(run.deductionTotal),
    advanceTotal: Number(run.advanceTotal),
    netTotal: Number(run.netTotal),
    advanceIssues: [],
    posted: {
      runId: run.id,
      postedAt: run.postedAt,
      netTotal: Number(run.netTotal),
    },
    missingSalary: [],
  }
}

/** The id of the Salaries category, created on first use. */
export async function getSalaryCategoryId(): Promise<string> {
  const [found] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(eq(expenseCategories.name, SALARY_CATEGORY))
    .limit(1)
  if (found) return found.id

  const [created] = await db
    .insert(expenseCategories)
    .values({ name: SALARY_CATEGORY, isTripRelated: false })
    .onConflictDoNothing({ target: expenseCategories.name })
    .returning({ id: expenseCategories.id })
  if (created) return created.id

  // Lost the race with a concurrent insert — read the winner's row.
  const [existing] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(eq(expenseCategories.name, SALARY_CATEGORY))
    .limit(1)
  return existing.id
}

export async function createRun(
  values: typeof payrollRuns.$inferInsert,
  client: Tx | typeof db = db
) {
  const [row] = await client.insert(payrollRuns).values(values).returning()
  return row
}

export async function createLine(
  values: typeof payrollLines.$inferInsert,
  client: Tx | typeof db = db
) {
  const [row] = await client.insert(payrollLines).values(values).returning()
  return row
}

export async function setLineExpense(
  lineId: string,
  expenseId: string,
  client: Tx | typeof db = db
) {
  await client.update(payrollLines).set({ expenseId }).where(eq(payrollLines.id, lineId))
}

export interface PostedRunRow {
  id: string
  month: string
  monthLabel: string
  employeeCount: number
  netTotal: number
  postedAt: Date
}

/** Every month already paid, newest first. */
export async function listRuns(): Promise<PostedRunRow[]> {
  const rows = await db
    .select()
    .from(payrollRuns)
    .orderBy(desc(payrollRuns.month))
    .limit(24)

  return rows.map((row) => ({
    id: row.id,
    month: row.month,
    monthLabel: monthBounds(row.month).label,
    employeeCount: row.employeeCount,
    netTotal: Number(row.netTotal),
    postedAt: row.postedAt,
  }))
}

/** The salary expenses a run wrote, for the "what did this post" view. */
export async function listRunExpenses(runId: string) {
  return db
    .select({
      expenseId: expenses.id,
      number: expenses.number,
      amount: expenses.amount,
      description: expenses.description,
    })
    .from(payrollLines)
    .innerJoin(expenses, eq(expenses.id, payrollLines.expenseId))
    .where(eq(payrollLines.runId, runId))
}

// ---------------------------------------------------------------- advances

export interface SalaryAdvanceRow {
  id: string
  employeeId: string
  empCode: string
  name: string
  month: string
  amount: number
  givenOn: string
  mode: string
  notes: string | null
  expenseNumber: string | null
  /** True once the month it is recovered in has been posted. */
  locked: boolean
}

/** Every advance to be recovered from a month, oldest first. */
export async function listAdvances(month: string): Promise<SalaryAdvanceRow[]> {
  const first = normaliseMonth(month)
  const rows = await db
    .select({
      advance: salaryAdvances,
      empCode: employees.empCode,
      name: employees.name,
      expenseNumber: expenses.number,
    })
    .from(salaryAdvances)
    .innerJoin(employees, eq(employees.id, salaryAdvances.employeeId))
    .leftJoin(expenses, eq(expenses.id, salaryAdvances.expenseId))
    .where(and(eq(salaryAdvances.month, first), isNull(salaryAdvances.deletedAt)))
    .orderBy(asc(salaryAdvances.givenOn), asc(salaryAdvances.createdAt))

  return rows.map(({ advance, empCode, name, expenseNumber }) => ({
    id: advance.id,
    employeeId: advance.employeeId,
    empCode,
    name,
    month: advance.month,
    amount: Number(advance.amount),
    givenOn: advance.givenOn,
    mode: advance.mode,
    notes: advance.notes,
    expenseNumber,
    locked: advance.payrollLineId !== null,
  }))
}

export async function getAdvance(id: string) {
  const [row] = await db
    .select()
    .from(salaryAdvances)
    .where(and(eq(salaryAdvances.id, id), isNull(salaryAdvances.deletedAt)))
    .limit(1)
  return row ?? null
}

/** Whether a month already has a posted run — advances for it are then closed. */
export async function isMonthPosted(month: string): Promise<boolean> {
  return (await getRun(normaliseMonth(month))) !== null
}

export async function createAdvance(
  values: typeof salaryAdvances.$inferInsert,
  client: Tx | typeof db = db
) {
  const [row] = await client.insert(salaryAdvances).values(values).returning()
  return row
}

/** Removes an unrecovered advance and the expense it wrote, together. */
export async function softDeleteAdvance(id: string, client: Tx | typeof db = db) {
  const now = new Date()
  const [row] = await client
    .update(salaryAdvances)
    .set({ deletedAt: now })
    .where(
      and(
        eq(salaryAdvances.id, id),
        isNull(salaryAdvances.deletedAt),
        isNull(salaryAdvances.payrollLineId)
      )
    )
    .returning()
  if (row?.expenseId) {
    await client
      .update(expenses)
      .set({ deletedAt: now })
      .where(eq(expenses.id, row.expenseId))
  }
  return row ?? null
}

/** Ties a month's advances to the payroll line that recovered them. */
export async function lockAdvances(
  employeeId: string,
  month: string,
  lineId: string,
  client: Tx | typeof db = db
) {
  await client
    .update(salaryAdvances)
    .set({ payrollLineId: lineId })
    .where(
      and(
        eq(salaryAdvances.employeeId, employeeId),
        eq(salaryAdvances.month, normaliseMonth(month)),
        isNull(salaryAdvances.deletedAt),
        isNull(salaryAdvances.payrollLineId)
      )
    )
}
