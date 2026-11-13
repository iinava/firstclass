import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, money, pk, softDelete, timestamps } from "./_shared"
import { employees } from "./hrms.schema"
import { expenses, paymentModeEnum } from "./accounts.schema"

/**
 * Monthly salary runs.
 *
 * A row exists only once a month has been *posted* — until then the figures are
 * computed live from the attendance register, so nothing has to be kept in sync.
 * Posting is the point at which pay becomes a fact: it writes one expense per
 * employee and freezes the arithmetic that produced it.
 *
 * The unique index on `month` is what makes double-posting impossible, rather
 * than a check in application code that a second tab could race past.
 */
export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: pk(),
    /** Always the first day of the month being paid. */
    month: date("month").notNull(),
    employeeCount: integer("employee_count").notNull(),
    /** Sum of the employees' monthly salaries, before deductions. */
    grossTotal: money("gross_total").notNull().default(0),
    deductionTotal: money("deduction_total").notNull().default(0),
    /** Salary advances recovered in this run. Already paid out, so not in netTotal. */
    advanceTotal: money("advance_total").notNull().default(0),
    netTotal: money("net_total").notNull().default(0),
    postedBy: actor("posted_by"),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("payroll_runs_month_key").on(t.month)]
)

/**
 * One line per employee in a posted run.
 *
 * The day counts are stored as they were read off the register, so a month can
 * always be explained after the fact even if attendance is later corrected.
 * Half-days are their own count rather than a fractional day, which keeps every
 * column an exact integer.
 */
export const payrollLines = pgTable(
  "payroll_lines",
  {
    id: pk(),
    runId: uuid("run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    /** dayRate x daysInMonth — the monthly-equivalent gross at the time of the run. */
    monthlySalary: money("monthly_salary").notNull(),
    /** The employee's per-day salary at the time of the run. */
    dayRate: money("day_rate").notNull(),
    daysInMonth: integer("days_in_month").notNull(),
    /**
     * The employee's paid-leave allowance as it stood when this run posted —
     * copied here (not just read off the employee) so a later change to their
     * allowance never rewrites what was already paid.
     */
    paidLeaveAllowance: integer("paid_leave_allowance").notNull().default(2),

    daysPresent: integer("days_present").notNull().default(0),
    daysHalf: integer("days_half").notNull().default(0),
    daysAbsent: integer("days_absent").notNull().default(0),
    /** Leave days covered by the monthly allowance. */
    daysPaidLeave: integer("days_paid_leave").notNull().default(0),
    /** Leave days beyond the allowance — these are deducted. */
    daysUnpaidLeave: integer("days_unpaid_leave").notNull().default(0),
    daysHoliday: integer("days_holiday").notNull().default(0),
    daysWeekOff: integer("days_week_off").notNull().default(0),
    /** Days the register was never marked. Treated as paid, but counted. */
    daysUnmarked: integer("days_unmarked").notNull().default(0),

    deduction: money("deduction").notNull().default(0),
    /**
     * Salary advances recovered from this month's pay. The advance was already
     * booked as an expense on the day it was handed over, so netPay is what is
     * left to pay: monthlySalary - deduction - advance.
     */
    advance: money("advance").notNull().default(0),
    netPay: money("net_pay").notNull(),

    /** The expense this line wrote, so the two can always be reconciled. */
    expenseId: uuid("expense_id").references(() => expenses.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("payroll_lines_run_employee_key").on(t.runId, t.employeeId),
    index("payroll_lines_employee_idx").on(t.employeeId),
  ]
)

/**
 * Money an employee took ahead of payday, to be recovered from one month's pay.
 *
 * Recording an advance books an expense under Salaries straight away — the cash
 * left the business that day — and payroll then pays only what remains. Over the
 * month the employee's Salaries expense still adds up to exactly what they earned.
 *
 * `payrollLineId` is set when the month it is recovered in gets posted; from then
 * on the advance is part of history and can no longer be changed or removed.
 */
export const salaryAdvances = pgTable(
  "salary_advances",
  {
    id: pk(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    /** First day of the month whose salary this is recovered from. */
    month: date("month").notNull(),
    amount: money("amount").notNull(),
    /** The day the money was handed over. */
    givenOn: date("given_on").notNull(),
    mode: paymentModeEnum("mode").notNull().default("cash"),
    notes: text("notes"),
    /** The expense written when the advance was handed over. */
    expenseId: uuid("expense_id").references(() => expenses.id, {
      onDelete: "set null",
    }),
    /** Set once the month is posted — the line this advance was recovered in. */
    payrollLineId: uuid("payroll_line_id").references(() => payrollLines.id, {
      onDelete: "set null",
    }),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("salary_advances_month_idx").on(t.month),
    index("salary_advances_employee_idx").on(t.employeeId),
  ]
)

export type PayrollRun = typeof payrollRuns.$inferSelect
export type NewPayrollRun = typeof payrollRuns.$inferInsert
export type PayrollLine = typeof payrollLines.$inferSelect
export type NewPayrollLine = typeof payrollLines.$inferInsert
export type SalaryAdvance = typeof salaryAdvances.$inferSelect
export type NewSalaryAdvance = typeof salaryAdvances.$inferInsert
