"use server"

import { revalidatePath } from "next/cache"
import { txDb } from "@/db/drizzle"
import { ActionFailure, defineAction } from "@/lib/action"
import { recordAudit } from "@/lib/audit"
import { nextExpenseNumber } from "@/lib/codes"
import { formatMoney } from "@/lib/money"
import * as accounts from "@/lib/services/accounts.service"
import * as hrms from "@/lib/services/hrms.service"
import * as payroll from "@/lib/services/payroll.service"
import {
  CreateSalaryAdvanceSchema,
  DeleteSalaryAdvanceSchema,
  PayrollPreviewSchema,
  PostPayrollSchema,
  SalaryAdvanceListSchema,
} from "@/validations/payroll.validation"

export const fetchPayrollPreview = defineAction({
  name: "fetchPayrollPreview",
  permission: "payroll:view",
  schema: PayrollPreviewSchema,
  handler: async ({ month }) => payroll.getPayrollPreview(month),
})

export const fetchPayrollRuns = defineAction({
  name: "fetchPayrollRuns",
  permission: "payroll:view",
  handler: async (_input: void) => payroll.listRuns(),
})

/**
 * Posts a month: freezes a line per employee and writes one expense each, under
 * the Salaries category.
 *
 * One expense per employee rather than a single lump sum, so "spend by category"
 * still totals correctly while a specific person's pay can be traced to a
 * specific entry. There is no unpost — a mistake is corrected the way every
 * other expense is, by editing or deleting the entries it created.
 */
export const postPayroll = defineAction({
  name: "postPayroll",
  permission: "payroll:run",
  schema: PostPayrollSchema,
  handler: async ({ month, expectedNetTotal, notes }, { session }) => {
    const preview = await payroll.getPayrollPreview(month)

    if (preview.posted) {
      throw new ActionFailure(`${preview.monthLabel} has already been posted`)
    }
    if (preview.lines.length === 0) {
      throw new ActionFailure(
        "No employee has a salary on record, so there is nothing to post"
      )
    }
    // An advance that this month cannot cover would otherwise be locked into a
    // posted month and never recovered.
    if (preview.advanceIssues.length > 0) {
      const first = preview.advanceIssues[0]
      throw new ActionFailure(
        `${first.name}'s advance of ${formatMoney(first.advance)} is more than ${
          first.payable > 0 ? `their ${formatMoney(first.payable)} pay` : "anything payable"
        } this month. Move it to another month before posting.`
      )
    }
    // Attendance may have been corrected between the screen loading and this
    // click. Paying a total the operator never saw is worse than making them
    // look again.
    if (preview.netTotal !== expectedNetTotal) {
      throw new ActionFailure(
        `The figures changed while you were looking — ${preview.monthLabel} now comes to ${formatMoney(
          preview.netTotal
        )}. Check the month again before posting.`
      )
    }

    const categoryId = await payroll.getSalaryCategoryId()
    // Salaries are paid at the end of the month they are for, so the expense
    // lands in that month's P&L rather than the month it was entered.
    const spentAt = lastDayOf(preview.month)

    const run = await txDb.transaction(async (tx) => {
      const run = await payroll.createRun(
        {
          month: preview.month,
          employeeCount: preview.lines.length,
          grossTotal: preview.grossTotal,
          deductionTotal: preview.deductionTotal,
          advanceTotal: preview.advanceTotal,
          netTotal: preview.netTotal,
          postedBy: session.userId,
          notes: notes ?? null,
        },
        tx
      )

      for (const line of preview.lines) {
        const stored = await payroll.createLine(
          {
            runId: run.id,
            employeeId: line.employeeId,
            monthlySalary: line.monthlySalary,
            dayRate: line.dayRate,
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
            deduction: line.deduction,
            advance: line.advance,
            netPay: line.netPay,
          },
          tx
        )

        if (line.advance > 0) {
          await payroll.lockAdvances(line.employeeId, preview.month, stored.id, tx)
        }

        // An advance can cover the whole month, leaving nothing more to pay —
        // the advance's own expense already carries the cost.
        if (line.netPay === 0) continue

        const expense = await accounts.createExpense(
          {
            number: await nextExpenseNumber(new Date(spentAt)),
            categoryId,
            description: `Salary — ${line.name} (${preview.monthLabel})${
              line.advance > 0 ? ` after ${formatMoney(line.advance)} advance` : ""
            }`,
            amount: line.netPay,
            spentAt,
            mode: "bank_transfer",
            createdBy: session.userId,
          },
          tx
        )

        await payroll.setLineExpense(stored.id, expense.id, tx)
      }

      return run
    })

    await recordAudit({
      entity: "payroll_runs",
      entityId: run.id,
      action: "create",
      summary: `Posted payroll for ${preview.monthLabel} — ${
        preview.lines.length
      } employees, ${formatMoney(preview.netTotal)}`,
      session,
    })

    revalidatePath("/admin/payroll")
    revalidatePath("/admin/expenses")
    revalidatePath("/admin/reports")
    return { runId: run.id, netTotal: preview.netTotal }
  },
})

// ------------------------------------------------------------ salary advances

export const fetchSalaryAdvances = defineAction({
  name: "fetchSalaryAdvances",
  permission: "payroll:view",
  schema: SalaryAdvanceListSchema,
  handler: async ({ month }) => payroll.listAdvances(month),
})

/**
 * Records money handed to an employee ahead of payday.
 *
 * The cash leaves the business now, so an expense is written now — under
 * Salaries, dated the day it was given. When the month is posted, payroll pays
 * only what is left, so the Salaries total for the person is still exactly what
 * they earned.
 */
export const createSalaryAdvance = defineAction({
  name: "createSalaryAdvance",
  permission: "payroll:run",
  schema: CreateSalaryAdvanceSchema,
  handler: async (input, { session }) => {
    const month = payroll.normaliseMonth(input.month)

    if (await payroll.isMonthPosted(month)) {
      throw new ActionFailure(
        "That month's payroll is already posted — record the advance against a later month"
      )
    }
    const employee = await hrms.getEmployee(input.employeeId)
    if (!employee) {
      throw new ActionFailure("Employee not found", { employeeId: ["Employee not found"] })
    }

    const categoryId = await payroll.getSalaryCategoryId()
    const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })

    const advance = await txDb.transaction(async (tx) => {
      const expense = await accounts.createExpense(
        {
          number: await nextExpenseNumber(new Date(input.givenOn)),
          categoryId,
          description: `Salary advance — ${employee.name} (from ${monthLabel} salary)`,
          amount: input.amount,
          spentAt: input.givenOn,
          mode: input.mode,
          notes: input.notes ?? null,
          createdBy: session.userId,
        },
        tx
      )

      return payroll.createAdvance(
        {
          employeeId: employee.id,
          month,
          amount: input.amount,
          givenOn: input.givenOn,
          mode: input.mode,
          notes: input.notes ?? null,
          expenseId: expense.id,
          createdBy: session.userId,
        },
        tx
      )
    })

    await recordAudit({
      entity: "salary_advances",
      entityId: advance.id,
      action: "create",
      summary: `Recorded ${formatMoney(input.amount)} salary advance for ${
        employee.name
      }, recovered from ${monthLabel}`,
      session,
    })

    revalidatePath("/admin/payroll")
    revalidatePath("/admin/expenses")
    return { id: advance.id }
  },
})

/** Removes an advance recorded by mistake, along with the expense it wrote. */
export const deleteSalaryAdvance = defineAction({
  name: "deleteSalaryAdvance",
  permission: "payroll:run",
  schema: DeleteSalaryAdvanceSchema,
  handler: async ({ id }, { session }) => {
    const advance = await payroll.getAdvance(id)
    if (!advance) throw new ActionFailure("Advance not found")
    if (advance.payrollLineId || (await payroll.isMonthPosted(advance.month))) {
      throw new ActionFailure(
        "This advance was recovered in a posted payroll and can no longer be removed"
      )
    }

    const removed = await txDb.transaction((tx) => payroll.softDeleteAdvance(id, tx))
    if (!removed) throw new ActionFailure("Advance not found")

    await recordAudit({
      entity: "salary_advances",
      entityId: id,
      action: "delete",
      summary: `Removed ${formatMoney(Number(advance.amount))} salary advance`,
      session,
    })

    revalidatePath("/admin/payroll")
    revalidatePath("/admin/expenses")
    return { id }
  },
})

/** "2026-08-01" -> "2026-08-31" */
function lastDayOf(firstOfMonth: string): string {
  const [year, month] = firstOfMonth.split("-").map(Number)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${firstOfMonth.slice(0, 8)}${String(days).padStart(2, "0")}`
}
