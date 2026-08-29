"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BanknoteIcon,
  CheckCircle2Icon,
  MinusCircleIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatCard } from "@/components/shared/stat-card"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useListParams } from "@/hooks/use-list-params"
import { formatDate, formatNumber } from "@/lib/format"
import { formatMoney, formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import type { PayrollLinePreview } from "@/lib/services/payroll.service"
import { fetchPayrollPreview, postPayroll } from "@/app/admin/payroll/actions"

/** The current month as YYYY-MM. */
function thisMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function PayrollView({ canPost }: { canPost: boolean }) {
  const { params, setFilter } = useListParams<{ month: string }>(["month"])
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? (params.month as string)
    : thisMonth()

  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: qk.payroll.month(month),
    queryFn: async () => unwrapAction(await fetchPayrollPreview({ month })),
  })

  const postMutation = useActionMutation({
    action: postPayroll,
    successMessage: "Payroll posted to expenses",
    invalidate: [qk.payroll.all, qk.accounts.all, qk.reports.all],
    onSuccess: () => setConfirmOpen(false),
  })

  const posted = data?.posted ?? null

  const columns = React.useMemo<DataTableColumn<PayrollLinePreview>[]>(
    () => [
      {
        key: "employee",
        header: "Employee",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.name}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {row.designation ? `${row.designation} · ` : ""}
              {row.empCode}
            </p>
          </div>
        ),
      },
      {
        key: "salary",
        header: "Salary",
        align: "right",
        cell: (row) => (
          <div className="min-w-0">
            <p className="tabular-nums">{formatMoneyShort(row.monthlySalary)}</p>
            <p className="text-[13px] whitespace-nowrap text-muted-foreground">
              {formatMoneyShort(row.dayRate)}/day
            </p>
          </div>
        ),
      },
      {
        key: "attendance",
        header: "Register",
        hideOnMobile: true,
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{row.daysPresent} present</Badge>
            {row.daysHalf > 0 && (
              <Badge variant="secondary">{row.daysHalf} half</Badge>
            )}
            {row.daysPaidLeave > 0 && (
              <Badge variant="secondary">{row.daysPaidLeave} paid leave</Badge>
            )}
            {row.daysUnmarked > 0 && (
              <Badge variant="outline">{row.daysUnmarked} unmarked</Badge>
            )}
          </div>
        ),
      },
      {
        key: "unpaid",
        header: "Unpaid days",
        align: "right",
        cell: (row) =>
          row.unpaidDays > 0 ? (
            <div className="min-w-0">
              <p className="tabular-nums">{row.unpaidDays}</p>
              <p className="text-[13px] whitespace-nowrap text-muted-foreground">
                {[
                  row.daysAbsent > 0 ? `${row.daysAbsent} absent` : null,
                  row.daysUnpaidLeave > 0
                    ? `${row.daysUnpaidLeave} over allowance`
                    : null,
                  row.daysHalf > 0 ? `${row.daysHalf} half-day` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "deduction",
        header: "Deduction",
        align: "right",
        cell: (row) =>
          row.deduction > 0 ? (
            <span className="tabular-nums text-red-600 dark:text-red-400">
              −{formatMoneyShort(row.deduction)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "net",
        header: "Net pay",
        align: "right",
        cell: (row) => (
          <span className="font-medium tabular-nums">{formatMoney(row.netPay)}</span>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Month picker and the posting control sit together — choosing a month and
          paying it are one task. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payroll-month">Month</Label>
          <Input
            id="payroll-month"
            type="month"
            className="w-44"
            value={month}
            onChange={(event) => setFilter("month", event.target.value)}
          />
        </div>

        {posted ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
            <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Posted on {formatDate(posted.postedAt)} — {formatMoney(posted.netTotal)}{" "}
              in Expenses
            </span>
          </div>
        ) : (
          canPost && (
            <Button
              disabled={isLoading || !data || data.lines.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <BanknoteIcon data-icon="inline-start" />
              Post to expenses
            </Button>
          )
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Employees on payroll"
          value={isLoading ? "—" : formatNumber(data?.lines.length ?? 0)}
          sub={data ? `${data.daysInMonth} days in ${data.monthLabel}` : undefined}
          icon={UsersIcon}
        />
        <StatCard
          label="Gross salaries"
          value={isLoading ? "—" : formatMoneyShort(data?.grossTotal ?? 0)}
          sub="Before deductions"
          icon={BanknoteIcon}
        />
        <StatCard
          label="Deductions"
          value={isLoading ? "—" : formatMoneyShort(data?.deductionTotal ?? 0)}
          sub="Leave beyond each employee's monthly allowance, and absences"
          tone={data && data.deductionTotal > 0 ? "warning" : "default"}
          icon={MinusCircleIcon}
        />
        <StatCard
          label="Net payable"
          value={isLoading ? "—" : formatMoneyShort(data?.netTotal ?? 0)}
          sub={posted ? "Already posted" : "Not yet posted"}
          tone="positive"
          icon={BanknoteIcon}
        />
      </div>

      {/* An employee with no salary on record cannot be paid, and silently
          leaving them out of the total is how someone gets missed. */}
      {data && data.missingSalary.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <span className="font-medium">
              {data.missingSalary.length} active{" "}
              {data.missingSalary.length === 1 ? "employee has" : "employees have"} no
              per-day salary on record
            </span>{" "}
            and {data.missingSalary.length === 1 ? "is" : "are"} left out of this run:{" "}
            {data.missingSalary.map((e) => e.name).join(", ")}. Set their per-day salary
            on the Employees screen and reload.
          </p>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.lines}
        getRowId={(row) => row.employeeId}
        isLoading={isLoading}
        emptyTitle="Nothing to pay this month"
        emptyDescription="Active employees with a per-day salary on record appear here."
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Post ${data?.monthLabel ?? "this month"}?`}
        description={
          <>
            This writes <strong>one expense per employee</strong> under Salaries,
            dated the last day of the month — {data?.lines.length ?? 0} entries
            totalling <strong>{formatMoney(data?.netTotal ?? 0)}</strong>. A month
            can only be posted once, and there is no undo: a mistake has to be
            corrected on the Expenses screen.
          </>
        }
        confirmLabel="Post to expenses"
        isPending={postMutation.isPending}
        onConfirm={() =>
          postMutation.mutate({
            month,
            expectedNetTotal: data?.netTotal ?? 0,
            notes: "",
          } as never)
        }
      />
    </div>
  )
}
