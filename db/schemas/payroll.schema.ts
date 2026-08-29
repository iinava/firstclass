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
import { actor, money, pk, timestamps } from "./_shared"
import { employees } from "./hrms.schema"
import { expenses } from "./accounts.schema"

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

export type PayrollRun = typeof payrollRuns.$inferSelect
export type NewPayrollRun = typeof payrollRuns.$inferInsert
export type PayrollLine = typeof payrollLines.$inferSelect
export type NewPayrollLine = typeof payrollLines.$inferInsert
