"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { OptionSelect } from "@/components/shared/option-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatCard } from "@/components/shared/stat-card"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate } from "@/lib/format"
import { formatMoneyCompact, formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import type { ExpenseListRow } from "@/lib/services/accounts.service"
import {
  approveExpense,
  deleteExpense,
  fetchExpenseCategories,
  fetchExpenses,
} from "@/app/admin/accounts-actions"
import { ExpenseFormDialog } from "./expense-form-dialog"

const PAGE_SIZE = 25

export function ExpensesView() {
  const { params, setSearch, setFilter, setPage } = useListParams<{
    categoryId: string
    from: string
    to: string
  }>(["categoryId", "from", "to"])

  const [searchInput, setSearchInput] = React.useState(params.search)
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  React.useEffect(() => {
    if (debouncedSearch !== params.search) setSearch(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const queryParams = React.useMemo(
    () => ({
      page: params.page,
      pageSize: PAGE_SIZE,
      search: params.search || undefined,
      sortDir: params.sortDir,
      categoryId: params.categoryId || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    }),
    [params.page, params.search, params.sortDir, params.categoryId, params.from, params.to]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.accounts.expenses(queryParams),
    queryFn: async () => unwrapAction(await fetchExpenses(queryParams)),
    placeholderData: (previous) => previous,
  })

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => unwrapAction(await fetchExpenseCategories()),
    staleTime: 5 * 60 * 1000,
  })

  const categoryFilterOptions = React.useMemo(
    () => [
      { value: "", label: "All categories" },
      ...(categories ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories]
  )

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ExpenseListRow | null>(null)
  const [deleting, setDeleting] = React.useState<ExpenseListRow | null>(null)

  const removeMutation = useActionMutation({
    action: deleteExpense,
    successMessage: "Expense deleted",
    invalidate: [qk.accounts.all, qk.reports.all],
    onSuccess: () => setDeleting(null),
  })

  const approveMutation = useActionMutation({
    action: approveExpense,
    successMessage: "Expense approved",
    invalidate: [qk.accounts.all],
  })

  const columns = React.useMemo<DataTableColumn<ExpenseListRow>[]>(
    () => [
      {
        key: "description",
        header: "Expense",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.description}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {row.number}
              {row.categoryName ? ` · ${row.categoryName}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "amount",
        align: "right",
        header: "Amount",
        cell: (row) => (
          <span className="tabular-nums font-medium">
            {formatMoneyShort(row.amount)}
          </span>
        ),
      },
      {
        key: "linked",
        header: "Linked to",
        hideOnMobile: true,
        cell: (row) =>
          row.bookingCode ? (
            <Link
              href={`/admin/trips/${row.bookingId}`}
              className="font-mono text-xs hover:underline"
            >
              {row.bookingCode}
            </Link>
          ) : row.vehicleReg ? (
            <span className="font-mono text-xs">{row.vehicleReg}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Overhead</span>
          ),
      },
      {
        key: "spentAt",
        header: "Date",
        cell: (row) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.spentAt)}
          </span>
        ),
      },
      {
        key: "approved",
        header: "Approved",
        hideOnMobile: true,
        cell: (row) =>
          row.approvedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
              <CheckCircle2Icon className="size-3.5" />
              {formatDate(row.approvedAt)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Pending</span>
          ),
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-10",
        cell: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {row.billUrl && (
                // Whoever approves the expense needs to see the bill, and the
                // table has no room for a preview column.
                <DropdownMenuItem
                  render={
                    <a href={row.billUrl} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <PaperclipIcon className="size-4" />
                  View bill
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                disabled={Boolean(row.approvedAt)}
                onClick={() => {
                  setEditing(row)
                  setFormOpen(true)
                }}
              >
                <PencilIcon className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={Boolean(row.approvedAt) || approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: row.id })}
              >
                <CheckCircle2Icon className="size-4" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={Boolean(row.approvedAt)}
                onClick={() => setDeleting(row)}
              >
                <Trash2Icon className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [approveMutation]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total for this filter"
          value={formatMoneyCompact(data?.filteredTotal ?? 0)}
          sub={`${data?.total ?? 0} expense${data?.total === 1 ? "" : "s"}`}
          icon={ReceiptIcon}
        />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupInput
              placeholder="Search description…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search expenses"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-44"
            aria-label="Filter by category"
            options={categoryFilterOptions}
            value={params.categoryId ?? ""}
            onValueChange={(value) => setFilter("categoryId", value)}
          />

          <DateRangeFilter
            from={params.from}
            to={params.to}
            onChange={(range) => {
              setFilter("from", range.from ?? null)
              setFilter("to", range.to ?? null)
            }}
            className="w-full sm:w-auto"
          />
        </div>

        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Log expense
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle="No expenses recorded"
        emptyDescription="Log fuel, tolls, driver allowances and office costs as they happen."
        pagination={
          data
            ? {
                page: data.page,
                pageCount: data.pageCount,
                total: data.total,
                pageSize: data.pageSize,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        expense={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this expense?"
        description="It is removed from trip profit and expense reports. Approved expenses can't be deleted."
        confirmLabel="Delete"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
