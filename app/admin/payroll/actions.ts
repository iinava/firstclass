"use server"

import { revalidatePath } from "next/cache"
import { txDb } from "@/db/drizzle"
import { ActionFailure, defineAction } from "@/lib/action"
import { recordAudit } from "@/lib/audit"
import { nextExpenseNumber } from "@/lib/codes"
import { formatMoney } from "@/lib/money"
import * as accounts from "@/lib/services/accounts.service"
import * as payroll from "@/lib/services/payroll.service"
import {
  PayrollPreviewSchema,
  PostPayrollSchema,
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
          paidLeaveAllowance: preview.paidLeaveAllowance,
          employeeCount: preview.lines.length,
          grossTotal: preview.grossTotal,
          deductionTotal: preview.deductionTotal,
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
            daysPresent: line.daysPresent,
            daysHalf: line.daysHalf,
            daysAbsent: line.daysAbsent,
            daysPaidLeave: line.daysPaidLeave,
            daysUnpaidLeave: line.daysUnpaidLeave,
            daysHoliday: line.daysHoliday,
            daysWeekOff: line.daysWeekOff,
            daysUnmarked: line.daysUnmarked,
            deduction: line.deduction,
            netPay: line.netPay,
          },
          tx
        )

        const expense = await accounts.createExpense(
          {
            number: await nextExpenseNumber(new Date(spentAt)),
            categoryId,
            description: `Salary — ${line.name} (${preview.monthLabel})`,
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

/** "2026-08-01" -> "2026-08-31" */
function lastDayOf(firstOfMonth: string): string {
  const [year, month] = firstOfMonth.split("-").map(Number)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${firstOfMonth.slice(0, 8)}${String(days).padStart(2, "0")}`
}
